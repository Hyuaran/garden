# Spec: 東海林さん何してる問題 解消機能（ShojiStatus）

- **対象**: Garden Bloom + 共通ホーム / ヘッダー
- **優先度**: 🔴 最高（GW 完成絶対、Garden 全体ボトルネック扱い）
- **見積（MVP）**: 0.5d（案 1 採択：手動オンリー）
- **担当**: a-bloom-002
- **作成**: 2026-04-26（a-main-007 → a-bloom-002 確定指示）
- **前提 memory**: `project_shoji_status_visibility.md` / `feedback_quality_over_speed_priority.md` / `project_garden_login_office_only.md`
- **前提 spec**:
  - `2026-04-24-bloom-workboard-design.md`（Workboard 基盤）
  - `2026-04-25-cross-ui-01-layout-theme.md`（Header の `achievementSlot` を流用検討）
  - `2026-04-25-cross-ui-06-access-routing.md`（共通ホーム配置場所）

---

## 1. 目的とスコープ

### 目的
社員が「東海林さん（社長）今何してる？」を **共通ホーム / 各モジュールのヘッダー** から即把握できる UI を提供する。MVP は手動更新ベース、自動収集（git log / 日報連動 / Garden Calendar）は Phase 2 以降。

### MVP（GW 完走条件）に含む
- `bloom_ceo_status` テーブル（1 レコード運用）
- 東海林さん用編集 UI（Workboard + ヘッダー右端ドロップダウン）
- 全社員用ウィジェット（共通ホーム + 各モジュールヘッダー）
- 詳細画面（`/bloom/workboard/ceo-status`）
- 30 秒 polling（タブ非表示時は停止）
- API Route（GET 全員 / PUT super_admin のみ）

### MVP に含まない（Phase 2 以降）
- B：月間スケジュール / Garden Calendar 連動
- C：タスク詰まりアラート検知
- 日報自動連動（Vercel から G ドライブ不可、別 dispatch 待ち）
- git log / Vercel deployments / Supabase Realtime
- 履歴可視化（updated_at の time-series UI）

---

## 2. データモデル

### 2.1 テーブル定義

```sql
-- migration: scripts/bloom-ceo-status-schema.sql
CREATE TABLE IF NOT EXISTS bloom_ceo_status (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status      text NOT NULL CHECK (status IN ('available','busy','focused','away')),
  summary     text,                -- 「a-main 006 で Root Phase B 確定中」等、最大 200 字
  updated_by  uuid NOT NULL REFERENCES root_employees(user_id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- MVP 運用：1 行のみ（status = '東海林さんの状態'）
-- 履歴は audit_log に任せる（Phase 2 で history table 検討）

-- 初期 seed（migration 内）
INSERT INTO bloom_ceo_status (status, summary, updated_by)
SELECT 'available', '初期化', user_id
FROM root_employees
WHERE garden_role = 'super_admin'
LIMIT 1
ON CONFLICT DO NOTHING;
```

### 2.2 ステータス対応表

| key | 表示 | 意味 | アイコン |
|---|---|---|---|
| `available` | 対応可能 | 質問・依頼 OK | 🟢 |
| `busy` | 取り込み中 | 電話なら対応可、メッセージは後回し | 🟡 |
| `focused` | 集中業務中 | 緊急以外は避けて | 🔴 |
| `away` | 外出中 | 翌日以降対応 | ⚪ |

→ Workboard spec 既存ステータスと**完全一致**（流用）

### 2.3 RLS

```sql
ALTER TABLE bloom_ceo_status ENABLE ROW LEVEL SECURITY;

-- 全認証ユーザーが SELECT 可
CREATE POLICY ceo_status_select_all
  ON bloom_ceo_status FOR SELECT
  TO authenticated
  USING (true);

-- super_admin のみ UPDATE 可
CREATE POLICY ceo_status_update_super_admin
  ON bloom_ceo_status FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM root_employees
      WHERE user_id = auth.uid()
        AND garden_role = 'super_admin'
    )
  );

-- INSERT は migration seed のみ、追加 INSERT 不可（policy なし＝拒否）
```

---

## 3. ファイル構成

```
src/
├─ components/shared/
│   ├─ ShojiStatusWidget.tsx       ← NEW: 全社員向け表示（compact / full）
│   └─ ShojiStatusContext.tsx      ← NEW: 30s polling provider
│
├─ app/
│   ├─ api/
│   │   └─ ceo-status/
│   │       └─ route.ts            ← NEW: GET / PUT
│   │
│   └─ bloom/
│       ├─ _components/
│       │   └─ CeoStatusEditor.tsx ← NEW: super_admin 用編集 form
│       │
│       └─ workboard/
│           └─ ceo-status/
│               └─ page.tsx        ← NEW: 詳細画面
│
└─ scripts/
    └─ bloom-ceo-status-schema.sql ← NEW: migration
```

---

## 4. API 仕様

### 4.1 `GET /api/ceo-status`
- 認証: 必須（authenticated role）
- レスポンス：
  ```ts
  {
    status: 'available' | 'busy' | 'focused' | 'away',
    summary: string | null,
    updated_at: string,           // ISO8601
    updated_by_name: string,      // root_employees.name JOIN
  }
  ```
- 失敗時：401 / 500（既存 cross-error-handling 準拠）

### 4.2 `PUT /api/ceo-status`
- 認証: 必須 + `garden_role = 'super_admin'` チェック（Route Handler 側で再確認、RLS と二重防御）
- リクエスト：
  ```ts
  {
    status: 'available' | 'busy' | 'focused' | 'away',
    summary?: string  // 200 字以内
  }
  ```
- レスポンス：4.1 と同じ（更新後）
- 失敗時：401 / 403 / 400 / 500

### 4.3 重要：RLS server/client 監査ルール準拠（memory `project_rls_server_client_audit`）
- Route Handler は `@supabase/ssr` の `createRouteHandlerClient` を使用（cookie 経由で auth 伝搬）
- ブラウザ用 anon `supabase` 流用は禁止（RLS が 100% ブロック）

---

## 5. UI 仕様

### 5.1 ShojiStatusWidget（compact mode）

**配置場所**：
- 共通ホーム `/`（cross-ui-06 の HomeScreen 内、9 アイコン上部）
- 各モジュールヘッダー右端（cross-ui-01 Header の `rightActions` スロット）

**見た目（compact、1 行 56px 高）**：
```
🟡 東海林：取り込み中  ｜ a-main 006 Root Phase B 確定中  ｜ 5 分前  →
```
- アイコン（status）+ 「東海林：」+ ラベル + summary（先頭 30 字 + …）+ 相対時刻 + クリックで詳細画面へ
- summary が NULL の場合は「メモなし」
- 30 分以上更新なし → 文字色グレー化（古い情報の可視化）

### 5.2 ShojiStatusWidget（full mode）

**配置**：`/bloom/workboard/ceo-status` 詳細画面 + Bloom Workboard カード

**見た目**：
```
┌─────────────────────────────────────┐
│ 🟡 東海林さん：取り込み中            │
│ ─────────────────────────────────── │
│ a-main 006 Root Phase B 確定中（全文）│
│                                     │
│ 最終更新: 2026-04-26 14:32 (5 分前)  │
│ 更新者: 東海林美琴                    │
└─────────────────────────────────────┘
```

### 5.3 CeoStatusEditor（super_admin のみ表示）

**配置**：
- ヘッダー右端「🟡 東海林：取り込み中」をクリック → ドロップダウン展開
- Workboard `/bloom/workboard/ceo-status` ページ内の「編集」ボタン

**Form**：
- Radio：4 ステータス（🟢🟡🔴⚪）
- Textarea：summary（200 字、placeholder「a-main 006 で Root Phase B 確定中」）
- Submit ボタン → PUT /api/ceo-status → 即時反映 + Toast「更新しました」

### 5.4 表示権限まとめ

| garden_role | Widget 表示 | Editor 表示 |
|---|---|---|
| toss / closer / cs / staff / manager / admin | ✅ compact + full | ❌ |
| super_admin（東海林さん） | ✅ + 編集 UI | ✅ |

---

## 6. polling 仕様

### 6.1 ShojiStatusContext

```tsx
// src/components/shared/ShojiStatusContext.tsx
'use client';

const POLL_INTERVAL_MS = 30000;

export function ShojiStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CeoStatus | null>(null);

  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/ceo-status');
        if (res.ok && active) setStatus(await res.json());
      } catch {/* silent retry on next tick */}
    };

    fetchStatus();
    const id = setInterval(fetchStatus, POLL_INTERVAL_MS);
    const onVisibility = () => { if (document.visibilityState === 'visible') fetchStatus(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <ShojiStatusContext.Provider value={status}>{children}</ShojiStatusContext.Provider>;
}
```

### 6.2 配置層
- ルート `src/app/layout.tsx` の `<body>` 内で `<ShojiStatusProvider>` ラップ
- 全 page で widget が同じ context を参照（重複 fetch なし）

---

## 7. 既存実装との整合

### 7.1 Bloom Workboard 既存ステータスとの関係
- `bloom_ceo_status` は東海林さん**専用**の global state（1 レコード）
- 既存 `bloom_worker_status`（全員分、Workboard 既設計）とは**別テーブル**
- 将来：Workboard 全員 status の中で super_admin 行を ShojiStatus として参照する形に統合検討（Phase 2）

### 7.2 認証・ロール
- `src/app/bloom/_lib/auth.ts` の `GardenRole` / `hasAccess` を流用
- Editor 表示判定：`hasAccess(role, 'super_admin')`（厳密一致が必要なら `role === 'super_admin'`）

### 7.3 共通ホーム未実装の暫定対応
- 共通ホーム `/` は cross-ui-01/06 実装後に正式配置
- MVP では `/bloom/workboard` ページに Widget を配置 + ヘッダーは Bloom 内のみ表示
- cross-ui-01 実装完了時に `Header` の `rightActions` に Widget を差し込む

---

## 8. 実装ステップ（0.5d ≒ 4h）

| # | 内容 | 見込 |
|---|---|---|
| 1 | `bloom-ceo-status-schema.sql` 作成 + 適用（garden-dev） | 0.5h |
| 2 | `src/app/api/ceo-status/route.ts` GET/PUT 実装 | 1.0h |
| 3 | `ShojiStatusContext.tsx` polling provider | 0.5h |
| 4 | `ShojiStatusWidget.tsx` compact + full mode | 1.0h |
| 5 | `CeoStatusEditor.tsx` form + PUT 連携 | 0.5h |
| 6 | `src/app/bloom/workboard/ceo-status/page.tsx` 詳細画面 | 0.3h |
| 7 | Bloom Workboard カードに Widget 配置 + 結合動作確認 | 0.2h |
| **合計** | | **4.0h（0.5d）** |

---

## 9. テスト観点

- **機能**：4 ステータス × 3 表示場所（home / header / detail）で正しく表示
- **権限**：toss/closer/cs/staff/manager/admin で Editor 非表示確認
- **RLS**：非 super_admin の curl PUT で 403 確認
- **polling**：tab 非表示で interval 停止、復帰時に即時 fetch
- **境界**：summary NULL / 200 字ちょうど / 200 字超 reject
- **時刻表示**：5 分前 / 30 分前（グレー化境界）/ 1 時間前 / 1 日前
- **エッジ**：bloom_ceo_status 行が空のときの表示（migration seed で防止、防御的に loading skeleton）

---

## 10. 既知の制約と Phase 2 への引継

### 制約
- `bloom_ceo_status` は単一行運用（東海林さん前提）。複数 super_admin 想定なし
- 30 秒 polling は SSE / WebSocket 化の余地あり（Phase 2 で Supabase Realtime）
- 履歴ビューなし（audit_log で代替、UI 化は Phase 2）

### Phase 2 候補（GW 後 dispatch）
- B：Garden Calendar 連動（出社/在宅/外出/会議の自動取得）
- C：詰まりアラート（24h 進捗なしタスク・滞留承認の検知）
- 日報自動連動（local PC → Supabase 書込スクリプト + ShojiStatus に merge）
- git log / Vercel deployments / Supabase Realtime
- 履歴 time-series UI

---

## 11. 関連 spec / memory

| 種別 | 参照先 |
|---|---|
| memory | `project_shoji_status_visibility.md` / `project_garden_login_office_only.md` / `feedback_quality_over_speed_priority.md` / `project_rls_server_client_audit.md` |
| spec | `2026-04-24-bloom-workboard-design.md` / `2026-04-25-cross-ui-01-layout-theme.md` / `2026-04-25-cross-ui-06-access-routing.md` |
| 実装基盤 | `src/app/bloom/_lib/auth.ts`（GardenRole / hasAccess） |

---

— spec-shoji-status-visibility v1 (MVP) end —
