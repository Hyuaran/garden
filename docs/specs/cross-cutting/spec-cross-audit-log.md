# Cross-Cutting Spec: 監査ログ統一戦略（root_audit_log）

- 優先度: **🔴 高**
- 見積: **1.0d**
- 作成: 2026-04-24（a-auto / Batch 7 Garden 横断 #2）
- 前提: Forest `_lib/audit.ts` / Root `_lib/audit.ts` 既存、モジュール別で書き方がバラついている

---

## 1. 背景と目的

### 1.1 現状の課題
- Forest / Root は既に `_lib/audit.ts` を持つが、**スキーマ・記録粒度がモジュールごとに分散**
- Bud / Leaf / Tree / Bloom は個別監査仕様を持たず、横断検索不可
- 税務調査・内部監査で「誰が何をしたか」を即座に回答できる体制が未整備
- 金銭・人事操作（給与改定・振込実行・マスタ変更）の記録漏れリスク

### 1.2 本 spec のゴール
- **`root_audit_log`** を Garden シリーズ共通の監査ログテーブルとして**一本化**
- 全モジュールからの書込規約（RPC or trigger）を統一
- 金銭・人事操作の記録を**必須化**（CI でチェック）
- SIEM / BI 連携のためのスキーマ正規化

---

## 2. テーブル設計

### 2.1 `root_audit_log`（既存整備 + 拡張）

```sql
CREATE TABLE IF NOT EXISTS root_audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- いつ
  occurred_at       timestamptz NOT NULL DEFAULT now(),

  -- 誰が
  actor_user_id     uuid REFERENCES auth.users(id),
  actor_role        text,                    -- at-time snapshot（garden_role）
  actor_employee_id text,                    -- root_employees.employee_id
  actor_ip          text,                    -- Route Handler で取得可能時

  -- 何を（主対象）
  module            text NOT NULL CHECK (module IN (
    'soil','root','tree','leaf','bud','bloom','forest','rill','seed','auth','system'
  )),
  action            text NOT NULL,           -- 'create' / 'update' / 'delete' / 'export' / 'login' 等
  entity_type       text NOT NULL,           -- 'bud_transfer' / 'root_employee' / 'forest_shinkouki' 等
  entity_id         text,                    -- 対象のプライマリキー（UUID や text）
  entity_label      text,                    -- 人間可読（'第 10 期 ヒュアラン' 等）

  -- どこで（コンテキスト）
  route             text,                    -- '/api/bud/transfers' 等
  http_method       text,                    -- 'POST', 'PATCH' 等
  user_agent        text,

  -- 何が変わった
  before_state      jsonb,                   -- 変更前の主要フィールド
  after_state       jsonb,                   -- 変更後
  diff_summary      text,                    -- 人間可読の要約（金額 123→456 等）

  -- メタ
  severity          text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('debug', 'info', 'warn', 'critical')),
  request_id        uuid,                    -- トレース用
  source            text,                    -- 'ui' / 'api' / 'cron' / 'trigger' / 'manual'
  notes             text,

  created_at        timestamptz NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX root_audit_log_actor_idx        ON root_audit_log (actor_user_id, occurred_at DESC);
CREATE INDEX root_audit_log_entity_idx       ON root_audit_log (entity_type, entity_id, occurred_at DESC);
CREATE INDEX root_audit_log_module_idx       ON root_audit_log (module, occurred_at DESC);
CREATE INDEX root_audit_log_severity_idx     ON root_audit_log (severity, occurred_at DESC)
  WHERE severity IN ('warn', 'critical');
CREATE INDEX root_audit_log_occurred_idx     ON root_audit_log (occurred_at DESC);
```

### 2.2 RLS

```sql
ALTER TABLE root_audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: admin + super_admin のみ
CREATE POLICY ral_read ON root_audit_log FOR SELECT
  USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
    IN ('admin', 'super_admin')
  );

-- INSERT: 認証済みユーザーなら誰でも（書込は SECURITY DEFINER 関数経由で制御）
CREATE POLICY ral_insert ON root_audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE / DELETE: 禁止（改ざん防止）
-- ポリシー未定義 = RLS により全拒否
```

**重要**: **UPDATE / DELETE は RLS で全拒否**。監査ログは追記専用、改ざん絶対不可。修正は新規 INSERT で補正記録。

---

## 3. 書込規約

### 3.1 共通ヘルパー関数

```sql
-- SECURITY DEFINER 関数で INSERT を強制統一
CREATE OR REPLACE FUNCTION write_audit_log(
  p_module text,
  p_action text,
  p_entity_type text,
  p_entity_id text DEFAULT NULL,
  p_entity_label text DEFAULT NULL,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL,
  p_diff text DEFAULT NULL,
  p_severity text DEFAULT 'info',
  p_route text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
  v_role text;
  v_emp text;
BEGIN
  -- actor 情報を auth.uid() から解決
  SELECT garden_role, employee_id INTO v_role, v_emp
    FROM root_employees WHERE user_id = auth.uid();

  INSERT INTO root_audit_log (
    actor_user_id, actor_role, actor_employee_id,
    module, action, entity_type, entity_id, entity_label,
    before_state, after_state, diff_summary,
    severity, route, notes
  ) VALUES (
    auth.uid(), v_role, v_emp,
    p_module, p_action, p_entity_type, p_entity_id, p_entity_label,
    p_before, p_after, p_diff,
    p_severity, p_route, p_notes
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION write_audit_log TO authenticated;
```

### 3.2 TypeScript クライアント

```typescript
// src/lib/audit/write.ts（新設、Garden シリーズ共通）
import { SupabaseClient } from '@supabase/supabase-js';

export type AuditModule =
  | 'soil' | 'root' | 'tree' | 'leaf' | 'bud'
  | 'bloom' | 'forest' | 'rill' | 'seed'
  | 'auth' | 'system';

export type AuditAction =
  | 'create' | 'update' | 'delete'
  | 'login' | 'logout' | 'export' | 'import'
  | 'approve' | 'reject' | 'confirm'
  | 'view' | 'download';

export type AuditSeverity = 'debug' | 'info' | 'warn' | 'critical';

export interface AuditLogInput {
  module: AuditModule;
  action: AuditAction | string;       // string も許容（モジュール固有アクション）
  entityType: string;
  entityId?: string;
  entityLabel?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  diff?: string;
  severity?: AuditSeverity;
  route?: string;
  notes?: string;
}

export async function writeAuditLog(
  client: SupabaseClient,
  input: AuditLogInput,
): Promise<{ success: true; auditId: string } | { success: false; error: string }> {
  const { data, error } = await client.rpc('write_audit_log', {
    p_module: input.module,
    p_action: input.action,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId ?? null,
    p_entity_label: input.entityLabel ?? null,
    p_before: input.before ?? null,
    p_after: input.after ?? null,
    p_diff: input.diff ?? null,
    p_severity: input.severity ?? 'info',
    p_route: input.route ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) {
    console.error('[audit] write failed', error);
    return { success: false, error: error.message };
  }
  return { success: true, auditId: data as string };
}
```

### 3.3 使用例

```typescript
// Bud 振込承認時
await writeAuditLog(supabase, {
  module: 'bud',
  action: 'approve',
  entityType: 'bud_transfer',
  entityId: transferId,
  entityLabel: `FK-${transferId.slice(0,8)} ¥${amount.toLocaleString()}`,
  before: { status: '承認待ち' },
  after: { status: '承認済み', approved_by: userId },
  diff: `status: 承認待ち → 承認済み`,
  severity: 'info',
  route: '/api/bud/transfers/approve',
});
```

---

## 4. 記録必須アクション一覧

### 4.1 🔴 必須記録（金銭・人事・権限変動）

| モジュール | アクション | severity |
|---|---|---|
| **Bud** | 振込状態遷移（全 7 ステータス）| info |
| **Bud** | CSV 出力（給与・通常）| info |
| **Bud** | 振込完了マーク | info |
| **Bud** | 給与計算実行 / 再計算 / 取消 | info / warn |
| **Bud** | 賞与計算 | info |
| **Bud** | 手動金額修正 | **warn** |
| **Bud** | 料率表更新（social_insurance / income_tax）| **warn** |
| **Root** | `garden_role` 変更 | **critical** |
| **Root** | 従業員マスタ削除 / 無効化 | warn |
| **Root** | 給与体系変更 | warn |
| **Root** | KoT 取込実行 | info |
| **Forest** | 決算書 ZIP ダウンロード | info |
| **Forest** | 進行期編集 | info |
| **Forest** | 販管費編集 | info |
| **auth** | ログイン / ログアウト | info |
| **auth** | ログイン失敗（3 回連続）| **warn** |

### 4.2 🟡 推奨記録

| モジュール | アクション |
|---|---|
| **Leaf** | 案件ステータス遷移 |
| **Tree** | 架電結果登録 |
| **Bloom** | 月次ダイジェスト発行 / PDF エクスポート |
| **Rill** | 外部 API 送信 |

### 4.3 🟢 オプション（容量削減優先）

- 閲覧（view）ログは 🔴 カテゴリのみ（給与閲覧等）
- 検索クエリは記録しない

---

## 5. Trigger vs Server Action どちらで書くか

### 5.1 Trigger 採用ケース
- **必須記録かつ**モジュール内完結する操作
- 例: `bud_transfers.status` 遷移 → trigger で `root_audit_log` に追記

```sql
CREATE OR REPLACE FUNCTION bud_transfers_audit_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM write_audit_log(
    'bud', 'update', 'bud_transfer',
    NEW.id::text, NEW.transfer_id,
    to_jsonb(OLD), to_jsonb(NEW),
    CASE
      WHEN OLD.status IS DISTINCT FROM NEW.status
        THEN format('status: %s → %s', OLD.status, NEW.status)
      ELSE '更新'
    END,
    'info'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER bud_transfers_audit
  AFTER UPDATE OR DELETE ON bud_transfers
  FOR EACH ROW
  EXECUTE FUNCTION bud_transfers_audit_trigger();
```

### 5.2 Server Action 採用ケース
- **業務コンテキスト**が必要（承認理由・差戻し理由等）
- 複数テーブル横断の操作
- 例: 給与一括計算、振込承認（reason 必要）

```typescript
export async function approveTransfer(transferId: string) {
  const { error } = await supabase.rpc('bud_transition_transfer_status', {...});
  if (!error) {
    await writeAuditLog(supabase, {
      module: 'bud',
      action: 'approve',
      entityType: 'bud_transfer',
      entityId: transferId,
      // ...
    });
  }
}
```

### 5.3 Trigger + Server Action の二重記録

高機密操作は**両方**記録（trigger = データ整合性、server action = 業務コンテキスト）。
Bud 振込承認は既に B-04 spec で二重記録が前提。

---

## 6. 既存 `_lib/audit.ts` の扱い

### 6.1 現状

| モジュール | ファイル | 役割 |
|---|---|---|
| Forest | `src/app/forest/_lib/audit.ts` | 既存、独自スキーマの可能性 |
| Root | `src/app/root/_lib/audit.ts` | 既存 |

### 6.2 統一方針

1. **`src/lib/audit/write.ts`** を新設（本 spec §3.2）
2. 各モジュールの `_lib/audit.ts` は **re-export のみ** に簡略化：
   ```typescript
   // src/app/forest/_lib/audit.ts
   export { writeAuditLog as writeForestAuditLog } from '@/lib/audit/write';
   ```
3. 将来的に Forest / Root の既存呼出を `'forest'` / `'root'` module 指定の共通関数に移行

---

## 7. 監査レポート UI（admin 向け）

### 7.1 画面 `/root/audit`

```
┌─ 監査ログ ────────────────────────────────┐
│ フィルタ: [期間] [モジュール] [severity]      │
│                                            │
│ 2026-04-24 10:23 [warn] [bud] approve      │
│   actor: 東海林 (super_admin)              │
│   target: FK-20260424-0001 ¥1,250,000      │
│   → status: 承認待ち → 承認済み             │
│   route: /api/bud/transfers/approve        │
│                                            │
│ 2026-04-24 10:20 [critical] [root] update  │
│   actor: 東海林 (super_admin)              │
│   target: 従業員 0009 萩尾                 │
│   → garden_role: staff → manager           │
│   ⚠️ 権限変更                               │
│                                            │
└────────────────────────────────────────────┘
```

### 7.2 機能

- 期間・モジュール・severity・actor でフィルタ
- entity_id / entity_type で前後ログを遡及
- CSV エクスポート（税務調査対応）
- **severity=critical の alert 通知**（Chatwork 管理者 DM、即時）

---

## 8. 実装ステップ

### W1: スキーマ・関数整備（0.25d）
- [ ] `root_audit_log` 既存確認 + 拡張列追加（before_state / after_state / diff_summary / request_id 等）
- [ ] `write_audit_log()` SECURITY DEFINER 関数投入
- [ ] RLS ポリシー（SELECT admin+ / INSERT 全認証 / UPDATE DELETE 全拒否）

### W2: TypeScript クライアント（0.1d）
- [ ] `src/lib/audit/write.ts` 新設
- [ ] 各モジュール `_lib/audit.ts` を re-export に置換

### W3: Trigger 整備（0.25d）
- [ ] `bud_transfers` UPDATE trigger
- [ ] `root_employees.garden_role` 変更 trigger（critical）
- [ ] `forest_shinkouki` UPDATE trigger

### W4: Server Action 埋込（0.25d）
- [ ] Bud 承認フロー（B-04 と連携）
- [ ] 給与計算実行（B-01 との連携）
- [ ] Root マスタ変更

### W5: 監査 UI（0.15d）
- [ ] `/root/audit` 画面（admin+）
- [ ] CSV エクスポート
- [ ] critical 通知

---

## 9. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | 保存期間 | **永続**（税法 7 年 + 余裕）、パーティション切替は 3 年超分を cold storage へ |
| 判2 | before/after のフィールド数制限 | 主要 10 フィールドに絞る（jsonb の過大化防止）|
| 判3 | 閲覧ログ（view アクション）の記録粒度 | 給与・賞与のみ必須、他は任意 |
| 判4 | SIEM（Splunk 等）連携 | Phase D 以降、現状は Supabase 内で完結 |
| 判5 | 匿名化エクスポート | 判断保留、税務調査では原データ提出前提 |
| 判6 | actor_ip の取得方法 | Vercel の `x-forwarded-for` header 、ただし信頼性限定 |
| 判7 | Trigger での SECURITY DEFINER 問題 | auth.uid() が trigger 内で使えないケース → session_user に fallback |

---

## 10. 次アクション

1. **既存 `root_audit_log` の現状スキーマ確認**（Root チーム or Forest チーム）
2. 本 spec 投入順序: W1 → W2 → W3 → W4 → W5
3. `known-pitfalls.md` に「監査ログは UPDATE/DELETE 禁止、改ざん絶対不可」を追記
