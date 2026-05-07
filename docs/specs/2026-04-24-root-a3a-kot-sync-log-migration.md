# Root Phase A-3-a: `root_kot_sync_log` Migration

- 作成: 2026-04-24（a-main）
- 対象モジュール: Garden-Root
- 見込み時間: **0.3d（約 2.5h）**
- 先行依存: Root Phase A-2（KoT API 連携）完了済
- 後続依存: A-3-b（/root/kot-sync-history UI）／ A-3-c（Vercel Cron）
- 担当: a-root セッション

---

## 1. 目的

KoT 連携（月次・日次・マスタ）の**同期履歴を一元管理するテーブル**を導入する。現状は KoT 同期の成功/失敗がクライアント UI 側の toast のみで消えるため、以下が実現できていない：

- 失敗した同期の再実行
- 過去の同期結果の監査
- Cron 経由の自動同期の可観測性
- admin による同期トラブルの一次切り分け

A-3-b 以降の画面・Cron・日次同期の**すべての基盤**となるテーブル。

---

## 2. 前提

### 既存テーブル
- `root_employees` / `root_attendance` — 書込先（既存）
- `root_companies` / `root_bank_accounts` / `root_insurance` / `root_salary_systems` / `root_vendors` — 7 マスタ（既存）

### 既存 RLS パターン
- Root モジュールは admin / super_admin のみ書込
- 閲覧は staff+（一部 manager+）

### 参照実装
- 既存 migration: `supabase/migrations/202604*_root_*.sql`
- `src/app/root/_lib/audit.ts`（監査ログ）との使い分け：audit は**ユーザー操作ログ**、sync_log は**システム同期履歴**

---

## 3. スキーマ定義

```sql
-- supabase/migrations/20260425000001_root_kot_sync_log.sql

create table if not exists public.root_kot_sync_log (
  id                uuid primary key default gen_random_uuid(),

  -- 何の同期か
  sync_type         text not null check (sync_type in ('masters', 'monthly_attendance', 'daily_attendance')),
  sync_target       text,                                       -- '2026-04' / '2026-04-24' / 'all'

  -- 誰が起動したか
  triggered_by      text not null,                              -- user_id (uuid 文字列) or 'cron'
  triggered_at      timestamptz not null default now(),

  -- 実行時間
  started_at        timestamptz,
  completed_at      timestamptz,
  duration_ms       integer,

  -- 結果
  status            text not null check (status in ('running', 'success', 'partial', 'failure')),
  records_fetched   integer default 0,
  records_inserted  integer default 0,
  records_updated   integer default 0,
  records_skipped   integer default 0,

  -- エラー詳細（失敗時のみ）
  error_code        text,
  error_message     text,
  error_stack       text,

  -- 監査
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- updated_at trigger（既存の helper 関数流用）
create trigger set_updated_at_root_kot_sync_log
  before update on public.root_kot_sync_log
  for each row execute function public.set_updated_at();

-- Indexes
create index idx_root_kot_sync_log_triggered_at
  on public.root_kot_sync_log (triggered_at desc);

create index idx_root_kot_sync_log_type_time
  on public.root_kot_sync_log (sync_type, triggered_at desc);

create index idx_root_kot_sync_log_status
  on public.root_kot_sync_log (status)
  where status in ('failure', 'partial');

-- RLS
alter table public.root_kot_sync_log enable row level security;

-- admin / super_admin のみ閲覧（manager 以下は閲覧不可）
create policy "admin read kot sync log"
  on public.root_kot_sync_log
  for select
  using (
    exists (
      select 1 from public.root_employees e
      where e.user_id = auth.uid()
        and e.garden_role in ('admin', 'super_admin')
    )
  );

-- service_role のみ書込（Server Action / Cron 経由）
-- → anon / authenticated からの insert/update は拒否
-- service_role は RLS バイパスなので明示ポリシー不要
```

---

## 4. 実装手順

### Step 1: Migration ファイル作成
- パス: `supabase/migrations/20260425000001_root_kot_sync_log.sql`
- 上記 SQL を貼付

### Step 2: garden-dev へ適用
```bash
# Supabase CLI
supabase db push

# もしくは Dashboard の SQL Editor から実行
```
- 適用後、テーブル作成・RLS・index が揃っているか Dashboard で確認
- **garden-prod には後日まとめて反映**（§CLAUDE.md 開発ルール）

### Step 3: TypeScript 型定義
- `src/app/root/_types/kot-sync-log.ts` 新規
```ts
export type KotSyncType = "masters" | "monthly_attendance" | "daily_attendance";
export type KotSyncStatus = "running" | "success" | "partial" | "failure";

export type RootKotSyncLog = {
  id: string;
  sync_type: KotSyncType;
  sync_target: string | null;
  triggered_by: string;           // user_id or 'cron'
  triggered_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  status: KotSyncStatus;
  records_fetched: number;
  records_inserted: number;
  records_updated: number;
  records_skipped: number;
  error_code: string | null;
  error_message: string | null;
  error_stack: string | null;
};
```

### Step 4: 書込 helper 新規
- パス: `src/app/root/_lib/kot-sync-log.ts`
- 関数: `insertSyncLog(params)`, `updateSyncLogComplete(id, result)`, `updateSyncLogFailure(id, error)`
- service_role Supabase client を使う（既存の `serviceSupabase()` を export 化して流用）

### Step 5: 既存 `kot-sync.ts` に組込
- Server Action の先頭で `insertSyncLog({ sync_type: 'monthly_attendance', ... })`
- try/catch の成功ルートで `updateSyncLogComplete`
- catch で `updateSyncLogFailure`
- 既存の toast 通知は**残す**（両方走る）

---

## 5. テスト観点（§16 7 種テスト該当）

| # | 種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 月次同期成功 → log 1 行追加、status='success' |
| 2 | エッジケース | KoT API 401 → status='failure', error_code='UNAUTHORIZED' |
| 3 | 権限 | manager アカウントで select 不可（RLS 拒否） |
| 4 | データ境界 | records_* を 0 埋めでも NULL ならないこと |
| 5 | パフォーマンス | 1 年分 365 行の一覧 query が < 100ms |
| 6 | コンソール | 型エラー・RLS 警告なし |
| 7 | a11y | （UI は A-3-b 側で検証） |

---

## 6. 完了条件 (DoD)

- [ ] garden-dev に `root_kot_sync_log` テーブルが作成されている
- [ ] RLS policy が設定済（admin/super_admin 読取のみ）
- [ ] `src/app/root/_lib/kot-sync-log.ts` helper 実装済
- [ ] 既存 `kot-sync.ts` から log 書込が走る
- [ ] 型定義 `kot-sync-log.ts` 追加済
- [ ] 手動テストで月次同期 → log 1 行が入ることを確認
- [ ] commit + push + PR 発行（develop 向け）

---

## 7. 注意事項

- **garden-prod への migration は A-3 全完了後にまとめて**実行（本 spec は garden-dev のみ）
- service_role client は `kot-sync.ts` 既存の `serviceSupabase()` を export して再利用
- 既存 `root_kot_sync_errors` 相当のテーブルがあれば**本テーブルに統合**（別テーブル乱立を避ける）
- migration 連番は既存 migration の最新番号 + 1 を確認してから付与
