# Cross Ops #05: Garden 全体 データ保持・アーカイブ設計

- 対象: Garden 全モジュールのデータ保持期間 / 自動アーカイブ / 物理削除タイミング
- 優先度: **🟡 中**（法令遵守、DB サイズ管理）
- 見積: **0.5d**
- 担当セッション: a-main + a-root（共通基盤）+ 各モジュール
- 作成: 2026-04-26（a-auto 003 / Batch 15 Cross Ops #05）
- 前提:
  - memory: project_delete_pattern_garden_wide.md（論理 / 物理削除）
  - Cross History 全 6 件（履歴・削除統一規格）
  - Cross Ops #02 backup-recovery（バックアップは別軸）

---

## 1. 目的とスコープ

### 1.1 目的

Garden が扱う**全データの保持期間ポリシー**を、業種別・法令準拠で明文化し、**自動アーカイブ → 物理削除**を体系的に運用する。Kintone 時代の「全部残す」運用を脱し、必要十分な保持で DB サイズを管理可能にする。

### 1.2 含めるもの

- データ種別ごとの保持期間（法令根拠付き）
- 自動アーカイブ実装（論理削除 + N 日経過 → 別バケット移動）
- 物理削除の判断基準と実行手順
- 個人情報の特例（GDPR 等の削除要請）
- データのライフサイクル可視化

### 1.3 含めないもの

- 論理削除の操作 UI → Cross History #03/#04
- バックアップの保管期間 → #02
- 監査ログの改ざん防止 → spec-cross-audit-log

---

## 2. 法令上の保持期間

### 2.1 主要法令と保持期間

| 法令 | 対象 | 保持期間 |
|---|---|---|
| **労働基準法 109 条** | 賃金台帳・労働者名簿・出勤簿 | **5 年**（当面の経過措置 3 年）|
| **労働基準法 109 条** | 雇用に関する重要書類 | **5 年** |
| **法人税法 / 会社法**（帳簿書類）| 仕訳帳 / 元帳 / 貸借対照表 / 損益計算書 | **7 年**（最長 10 年）|
| **消費税法** | 帳簿・請求書等 | **7 年** |
| **電子帳簿保存法** | 電子取引の記録（請求書 PDF 等）| **7 年** |
| **健康保険法** | 健康保険関係書類 | **2 年** |
| **個人情報保護法** | 個人データ（不要になったら削除義務）| 必要期間のみ |
| **下請法** | 下請取引記録 | **2 年** |

### 2.2 Garden データへの適用

| データ種別 | 関連モジュール | 適用法令 | 保持期間 |
|---|---|---|---|
| 給与データ（給与明細・賃金台帳）| Bud | 労基法 109 | **5 年** |
| 振込履歴 / 取引履歴 | Bud | 法人税法 | **7 年** |
| 取引先請求書 PDF | Bud / Forest | 電子帳簿保存法 | **7 年** |
| 出勤簿 / 勤怠（KoT 同期分）| Root | 労基法 109 | **5 年** |
| 案件履歴（Leaf）| Leaf | 法人税法（取引）| **7 年** |
| 通話録音（Tree）| Tree | 個人情報法 | **必要期間のみ**（3 ヶ月推奨）|
| 顧客情報（リスト）| Soil | 個人情報法 | 取引終了後 **5 年**（法人税法に準拠）|
| 操作ログ（監査）| 全 | 電子帳簿保存法 | **7 年** |
| 設定値・UI 状態 | 全 | — | 不要になったら即削除可 |

---

## 3. データ分類と保持ステージ

### 3.1 ステージの定義

```
[Active]    通常利用中、Garden 内表示
   ↓ 業務完了 / 退職 / 契約終了
[Archived]  Garden では非表示、別バケット保管、必要時のみ抽出
   ↓ 法定保持期間経過
[Disposed]  物理削除済、記録のみ残る
```

### 3.2 ステージ別の動作

| ステージ | DB | Garden UI | バックアップ |
|---|---|---|---|
| Active | 通常テーブル | 表示 | 通常通り |
| Archived | `*_archive` テーブル or jsonb 圧縮 | 検索不可（管理者のみ）| 通常通り |
| Disposed | レコード削除 | 不可 | 削除済の記録のみ（メタデータ）|

### 3.3 ステージ移行のトリガ

| データ | Active → Archived | Archived → Disposed |
|---|---|---|
| 給与データ | 退職後 1 年 | 退職後 5 年 |
| 振込履歴 | 振込完了 1 年 | 7 年経過 |
| 案件 | 完了後 1 年 | 7 年経過 |
| 通話録音 | 録音 30 日 | 録音 90 日 |
| 顧客情報 | 取引終了後 1 年 | 取引終了後 5 年 |
| 操作ログ | 1 年 | 7 年 |

---

## 4. 自動アーカイブ実装

### 4.1 共通基盤テーブル

```sql
CREATE TABLE public.archive_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  source_table text NOT NULL,
  archive_method text NOT NULL,
    -- 'separate_table' | 'jsonb_compress' | 'storage_export'
  active_to_archive_days int NOT NULL,
  archive_to_dispose_days int NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  description text,
  UNIQUE (module, source_table)
);
```

### 4.2 ポリシー設定例

```sql
INSERT INTO archive_policies (module, source_table, archive_method, active_to_archive_days, archive_to_dispose_days, description)
VALUES
  ('bud', 'bud_salaries', 'separate_table', 365, 1825,
   '給与データ: 退職後 1 年で archive、5 年で物理削除'),
  ('bud', 'bud_furikomi', 'separate_table', 365, 2555,
   '振込履歴: 1 年経過で archive、7 年で物理削除'),
  ('tree', 'tree_call_recordings', 'storage_export', 30, 90,
   '通話録音: 30 日で外部 Storage 移動、90 日で物理削除'),
  ('root', 'operation_logs', 'jsonb_compress', 365, 2555,
   '操作ログ: 1 年で月次集約、7 年で物理削除');
```

### 4.3 アーカイブ Cron

```typescript
// src/app/api/cron/archive-runner/route.ts
// 毎日 02:00 JST 実行（業務影響最小時間帯）

export async function GET() {
  const policies = await fetchActivePolicies();
  for (const policy of policies) {
    try {
      const result = await runPolicy(policy);
      await updateLastRun(policy.id, result);
    } catch (e) {
      await recordMonitoringEvent({
        module: 'ops',
        category: 'archive_failure',
        severity: 'medium',
        source: '/api/cron/archive-runner',
        message: `アーカイブ実行に失敗: ${policy.module}/${policy.source_table}`,
        details: { policy, error: serializeError(e) },
      });
    }
  }
  return Response.json({ ok: true });
}
```

### 4.4 archive_method 別の実装

#### `separate_table` 方式

```sql
-- 1. アーカイブ先テーブル（最初の 1 回のみ作成）
CREATE TABLE bud_furikomi_archive (LIKE bud_furikomi INCLUDING ALL);
ALTER TABLE bud_furikomi_archive ADD COLUMN archived_at timestamptz NOT NULL DEFAULT now();

-- 2. アーカイブ実行（Cron 内で動的に発行）
WITH moved AS (
  DELETE FROM bud_furikomi
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '365 days'
  RETURNING *
)
INSERT INTO bud_furikomi_archive
SELECT *, now() AS archived_at FROM moved;
```

#### `jsonb_compress` 方式（操作ログ等の大量行）

```sql
-- 月単位で集約 jsonb 化
WITH monthly AS (
  SELECT
    date_trunc('month', occurred_at) AS month,
    user_id,
    jsonb_agg(jsonb_build_object(
      'occurred_at', occurred_at,
      'action', action,
      'target', target,
      'details', details
    )) AS events
  FROM operation_logs
  WHERE occurred_at < now() - interval '365 days'
  GROUP BY 1, 2
)
INSERT INTO operation_logs_compressed (month, user_id, events_json, event_count)
SELECT month, user_id, events, jsonb_array_length(events)
FROM monthly;

-- 元テーブルから削除
DELETE FROM operation_logs WHERE occurred_at < now() - interval '365 days';
```

#### `storage_export` 方式（通話録音等の大容量）

```typescript
// 1. Supabase Storage の音声ファイルを別バケットに移動
const records = await supabase
  .from('tree_call_recordings')
  .select('*')
  .lt('recorded_at', daysAgo(30));

for (const rec of records) {
  // ファイル移動
  await supabase.storage
    .from('tree-call-recordings')
    .move(rec.file_path, `archive/${rec.file_path}`, {
      destinationBucket: 'tree-call-recordings-archive',
    });
  // DB 側のフラグ更新
  await supabase
    .from('tree_call_recordings')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', rec.id);
}
```

---

## 5. 物理削除の判断と実行

### 5.1 物理削除の前提条件

物理削除を実行する前に**すべて**を満たすこと:

- [ ] 法定保持期間が経過済
- [ ] 過去 3 ヶ月、参照アクセスがゼロ（`audit_logs` で確認）
- [ ] バックアップが直近 30 日以内に取得済（#02）
- [ ] 個人情報の場合、本人からの削除要請が記録されている or 法定経過
- [ ] super_admin 承認 + Chatwork 通知済

### 5.2 物理削除実行手順

```
[1] 削除候補の抽出（Cron 月次レポート生成）
  ↓
[2] super_admin（東海林さん）が確認
  ↓
[3] Chatwork で削除予告（実行 7 日前）
  ↓
[4] 該当テーブルの全件 SHA256 ハッシュ取得 → 監査ログ記録
  ↓
[5] DELETE 実行（archive テーブルから）
  ↓
[6] 削除完了監査ログ + 件数記録
```

### 5.3 監査ログ記録

```sql
INSERT INTO operation_logs (
  user_id, module, action, target_type, target_id, details, occurred_at
) VALUES (
  '<super_admin_id>',
  'ops',
  'physical_delete',
  'bud_furikomi_archive',
  NULL,
  jsonb_build_object(
    'deleted_count', 1234,
    'criteria', 'archived_at < 2019-04-26',
    'backup_verified', true,
    'sha256_summary', 'xxx',
    'approved_by', '<super_admin_id>'
  ),
  now()
);
```

### 5.4 物理削除の例外

以下のデータは**永続保持**（物理削除しない）:

- 監査ログサマリ（操作内容のみ、個人情報除く）
- 物理削除実行記録自体
- システム設定変更履歴
- インシデント記録（`docs/incidents/`）

---

## 6. 個人情報削除要請（Privacy Request）

### 6.1 削除要請の受付フロー

```
個人から削除要請（メール / 書面）
  ↓
東海林さん受付 → Garden 管理画面で記録
  ↓
法定保持義務との整合確認
  - 7 年保管が必要なデータ → 個人特定不可化（仮名化）で対応
  - 不要データ → 即時削除
  ↓
実行 → Chatwork で本人に完了通知
  ↓
削除完了監査ログ
```

### 6.2 仮名化（Pseudonymization）

法定保持義務がある場合、**個人特定不可な形に変換**:

```sql
-- 例: 退職者 X さんの給与データ（5 年保管必須）を仮名化
UPDATE bud_salaries
SET
  employee_id = 'PSEUDONYMIZED_' || md5(employee_id::text),
  employee_name = 'PSEUDONYMIZED',
  bank_account = 'PSEUDONYMIZED',
  pseudonymized_at = now(),
  pseudonymized_reason = '本人の削除要請（法定保持のため仮名化）'
WHERE employee_id = '<元のID>';
```

### 6.3 削除要請テーブル

```sql
CREATE TABLE public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL,    -- 'delete' | 'pseudonymize' | 'export'
  subject_type text NOT NULL,    -- 'employee' | 'customer' | 'partner'
  subject_id text NOT NULL,
  requested_at timestamptz NOT NULL,
  requested_by text,             -- 受付担当
  legal_basis text,              -- 個人情報法 17/19 条 等
  scheduled_at timestamptz,      -- 実行予定
  executed_at timestamptz,
  executed_by text,              -- super_admin
  notes text
);
```

---

## 7. データライフサイクル可視化

### 7.1 Bloom 配下のダッシュボード

`/bloom/data-lifecycle` に以下を配置:

- モジュール別レコード数（Active / Archived / Disposed）
- 月次のアーカイブ実行件数
- 物理削除候補件数（次月実行予定）
- 個人情報削除要請の対応状況
- DB サイズ推移（テーブル別）

### 7.2 月次レポート

```typescript
// 毎月 1 日 03:00 JST
export async function GET() {
  const report = await generateMonthlyDataReport();
  // 例:
  // - bud_salaries: Active 1,234 / Archived 5,678 / Disposed 9,012
  // - tree_call_recordings: 物理削除 234 件、Storage 削減 12.3GB
  // - 個人情報削除要請: 受付 3 / 完了 2 / 進行中 1
  await sendChatworkNotification('Garden-運用-全体', report);
  return Response.json({ ok: true });
}
```

---

## 8. RLS（行レベルセキュリティ）の整合

### 8.1 archive テーブルの RLS

```sql
-- archive テーブルは super_admin / admin のみ参照可
CREATE POLICY archive_select_admin
  ON bud_furikomi_archive FOR SELECT
  TO authenticated
  USING (
    (SELECT garden_role FROM employees_view WHERE id = auth.uid())
    IN ('super_admin', 'admin')
  );

-- archive テーブルへの書込は service role のみ（Cron からのみ）
CREATE POLICY archive_insert_service
  ON bud_furikomi_archive FOR INSERT
  TO service_role
  WITH CHECK (true);
```

### 8.2 通常テーブルの`deleted_at`フィルタ

```sql
-- 既定 RLS で deleted_at IS NULL のみ表示
CREATE POLICY active_select
  ON bud_furikomi FOR SELECT
  USING (
    deleted_at IS NULL
    AND (...通常の権限条件)
  );

-- admin+ は削除済も表示可（履歴 UI から）
CREATE POLICY all_select_admin
  ON bud_furikomi FOR SELECT
  USING (
    (SELECT garden_role FROM employees_view WHERE id = auth.uid())
    IN ('admin', 'super_admin')
  );
```

---

## 9. テスト戦略

### 9.1 単体テスト

- `runPolicy()` の archive_method 別動作
- 仮名化関数の不可逆性検証
- 物理削除前提条件チェックの境界値

### 9.2 統合テスト

- アーカイブ Cron 全体フロー（Active → Archived → Disposed）
- archive テーブルの RLS（admin / 一般ユーザー）
- 物理削除実行後の監査ログ記録

### 9.3 法令準拠テスト（年次）

- 各データ種別の保持期間が法令準拠か
- 物理削除実行記録が監査可能か
- 個人情報削除要請の対応履歴が完全か

---

## 10. 段階導入計画

| Phase | スコープ | 完了条件 |
|---|---|---|
| **Phase A**（既存）| 論理削除のみ（deleted_at）| 全モジュール対応済 |
| **Phase B-1** | archive_policies 定義 + Cron 起動（実行は dry-run）| Cron 稼働、レポートのみ |
| **Phase B-2** | dry-run → 実 archive 実行（操作ログ等）| 1 ヶ月分の archive 完了 |
| **Phase C** | 物理削除実行（給与・振込）| 1 件以上の物理削除実行 |
| **Phase D** | 個人情報削除要請対応 | 削除要請テーブル + 仮名化 |

---

## 11. 既知のリスクと対策

### 11.1 archive 実行中の業務影響

- 大量レコード移動で DB 負荷増
- 対策: Cron は深夜時間帯（02:00）、1 回 10,000 件まで、進捗を chunk 単位で commit

### 11.2 archive テーブルからの誤参照

- 通常クエリで archive を参照 → 古いデータを表示
- 対策: archive テーブルは別スキーマ（`archive.*`）、誤った join を IDE/型で検知

### 11.3 物理削除の不可逆性

- 一度消すと戻せない
- 対策: §5.1 の前提条件 + バックアップ確認 + super_admin 承認を厳守

### 11.4 法令変更への追随

- 法令が改定（例: 労基法保持期間の延長）→ 既存ポリシー要更新
- 対策: 年次で `archive_policies` を法務確認（顧問弁護士 / 税理士）

### 11.5 仮名化の不完全性

- 関連テーブルに本名が残る、ログに記録されている等
- 対策: 仮名化対象の全テーブルを spec として明文化、年次で「再特定可能性」をテスト

### 11.6 通話録音の特例

- 個人情報法上「必要期間のみ」とされるが、業務上は 3 ヶ月程度必要なことが多い
- 対策: 3 ヶ月で外部 Storage 移動 → 90 日で削除、お客様への説明も整備

---

## 12. 関連ドキュメント

- `docs/specs/2026-04-25-cross-history-delete-04-delete-pattern.md`
- `docs/specs/2026-04-26-cross-ops-02-backup-recovery.md`
- `docs/specs/2026-04-26-cross-ops-03-incident-response.md`
- `docs/specs/cross-cutting/spec-cross-audit-log.md`
- `docs/specs/cross-cutting/spec-cross-rls-audit.md`

---

## 13. 受入基準（Definition of Done）

- [ ] `archive_policies` テーブル + 初期データ投入
- [ ] アーカイブ Cron `/api/cron/archive-runner` 稼働
- [ ] archive_method 3 種（separate_table / jsonb_compress / storage_export）の動作確認
- [ ] 物理削除手順を**1 件**実演（dry-run でも可）
- [ ] 仮名化関数 + privacy_requests テーブル 実装
- [ ] Bloom データライフサイクルダッシュボード公開
- [ ] 月次レポート Cron 稼働 + Chatwork 配信
- [ ] 法令保持期間（§2.2）を顧問税理士 / 弁護士に確認済
- [ ] archive テーブルの RLS テスト pass
- [ ] CLAUDE.md / known-pitfalls に保持期間ポリシー追記
