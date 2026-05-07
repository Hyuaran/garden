# Root Phase A-3-b: `/root/kot-sync-history` 画面

- 作成: 2026-04-24（a-main）
- 対象モジュール: Garden-Root
- 見込み時間: **0.5d（約 4h）**
- 先行依存: A-3-a（`root_kot_sync_log` migration）
- 後続依存: A-3-c（Cron からの参照あり）
- 担当: a-root セッション

---

## 1. 目的

KoT 同期履歴（A-3-a で導入したテーブル）の**閲覧・失敗時の再実行**を admin が行える画面を提供。

### ユーザーストーリー
- **UC1**: admin が今月の同期が成功したか確認したい
- **UC2**: 失敗した同期のエラー内容を確認して原因調査したい
- **UC3**: 失敗同期を画面から再実行したい
- **UC4**: Cron 自動同期の結果を朝チェックしたい

---

## 2. 前提

### 既存パターン再利用
- `src/app/root/_components/DataTable.tsx`（マスタ UI で使用中のテーブル）
- `src/app/root/_components/Modal.tsx`（エラー詳細表示用）
- `src/app/root/_components/StatusBadge.tsx`（status 表示）
- `src/app/root/_lib/queries.ts` と同じ pattern で fetch

### 画面仕様
- パス: `/root/kot-sync-history`
- ナビ: Root のサイドナビに「KoT 同期履歴」を追加（admin/super_admin のみ表示）
- レイアウト: Server Component ベース、フィルタ・モーダルは Client Component

---

## 3. UI 構成

### ページ構造

```
/root/kot-sync-history
├─ PageHeader（戻る / タイトル / 期間フィルタ）
├─ FilterBar（sync_type / status / 日付範囲）
├─ SyncHistoryTable（DataTable 再利用）
│   └─ 行クリック → SyncLogDetailModal
└─ Pagination（50 件/ページ）
```

### テーブルカラム

| カラム | 幅 | 表示 |
|---|---|---|
| 実行日時 | 160px | `triggered_at` を JST で `YYYY/MM/DD HH:mm:ss` |
| 種別 | 120px | masters / 月次 / 日次（日本語ラベル） |
| 対象 | 100px | `sync_target`（例: 2026-04、2026-04-24） |
| 起動者 | 120px | user_id → employee_no 名前 解決 / 'cron' はバッジ |
| ステータス | 80px | StatusBadge（success=緑 / partial=黄 / failure=赤 / running=青） |
| 処理時間 | 80px | `duration_ms` を秒表示 |
| 取得 | 60px | `records_fetched` |
| 追加 | 60px | `records_inserted` |
| 更新 | 60px | `records_updated` |
| スキップ | 60px | `records_skipped` |
| アクション | 100px | 失敗行のみ「再実行」ボタン |

### 詳細モーダル（行クリック時）
- 全カラムを表示
- `error_message` / `error_stack` を `<pre>` で表示
- 再実行ボタン（failure/partial 時のみ）
- KoT API レスポンス raw を貼付する場合のセクション（将来拡張）

---

## 4. 実装手順

### Step 1: ページ本体
- パス: `src/app/root/kot-sync-history/page.tsx`
- Server Component で初期データ fetch（最新 50 件）
- RLS で admin/super_admin 以外は redirect

```tsx
export default async function KotSyncHistoryPage() {
  await requireRootRole(["admin", "super_admin"]);  // 既存 helper 想定
  const initialLogs = await fetchSyncLogs({ limit: 50 });
  return (
    <RootShell>
      <PageHeader title="KoT 同期履歴" />
      <SyncHistoryClient initialLogs={initialLogs} />
    </RootShell>
  );
}
```

### Step 2: Query 層
- `src/app/root/_lib/queries.ts` に `fetchSyncLogs(filter)` 追加
- フィルタ: `sync_type?`, `status?`, `from?`, `to?`, `limit`, `offset`
- 並び: `triggered_at desc`
- Server Component から呼ぶ（SSR）

### Step 3: Client Component
- パス: `src/app/root/kot-sync-history/_components/SyncHistoryClient.tsx`
- フィルタ state 管理
- fetchSyncLogs の Server Action 経由 re-fetch
- DataTable に行データ流し込み

### Step 4: 詳細モーダル
- パス: `src/app/root/kot-sync-history/_components/SyncLogDetailModal.tsx`
- Modal 再利用
- 再実行 button → Server Action `rerunSync(logId)` 呼出

### Step 5: 再実行 Server Action
- パス: `src/app/root/_actions/kot-sync-rerun.ts`
- 挙動: 元 log の sync_type / sync_target を読み取り、対応する既存同期関数を再実行
- 新しい log 行が入る（元は残す）

### Step 6: サイドナビ追加
- 既存 `RootShell.tsx` or サイドナビコンポーネントに「KoT 同期履歴」リンク追加
- garden_role で admin/super_admin のみ表示

---

## 5. テスト観点（§16 7 種テスト該当）

| # | 種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 一覧 / フィルタ / ページング / 行クリック / 再実行 全通し |
| 2 | エッジケース | 0 件時「履歴なし」表示 / error_stack が 10KB 超でも崩れない |
| 3 | 権限 | manager 以下はサイドナビに非表示＋直接 URL アクセス時は redirect |
| 4 | データ境界 | records_* が NULL 時でも表示崩れなし |
| 5 | パフォーマンス | 1 年分 365 行表示時、初回表示 < 500ms |
| 6 | コンソール | error/warning ゼロ |
| 7 | a11y | テーブルの aria-label / モーダルの focus trap |

---

## 6. 完了条件 (DoD)

- [ ] `/root/kot-sync-history` にアクセスできる（admin）
- [ ] 一覧表示・フィルタ・ページング動作
- [ ] 詳細モーダルでエラー内容閲覧可能
- [ ] 失敗行から再実行できる（新 log 行が入る）
- [ ] manager 以下は 403 redirect
- [ ] サイドナビに項目追加（ロール制御あり）
- [ ] commit + push + PR 発行

---

## 7. 注意事項

- **再実行は冪等性に注意**: 同じ target を 2 回流して重複挿入にならないか確認（upsert パターンのはず）
- **running ステータスの長時間残留対策は A-3-c で実装**（本 spec では表示のみ）
- Server Component で fetch する際、`queries.ts` は **RLS 越しの通常 supabase client** を使う（service_role は不要、admin session 経由で通る）
- モーダル内のエラー詳細は **非技術者向け補足テキスト**も併記（例: 「401 エラー = KoT の認証トークンが期限切れまたは不正です」）
