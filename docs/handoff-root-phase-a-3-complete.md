# Handoff: Garden Root Phase A-3 完走（a-root セッション）

- 作成: 2026-04-25 a-root セッション
- ステータス: **Phase A-3 全 8 spec マージ完了 ✅**
- セッション状態: コンテキスト 90% 到達につき引退、次セッション起動時に本ファイル参照

---

## 1. Phase A-3 完走サマリ

| Task | 内容 | 見積 | 実績 | PR |
|---|---|---:|---:|---|
| A-3-e | KoT API IP 制限 Issue 起票 | 0.2d | 0.3d | [Issue #30](https://github.com/Hyuaran/garden/issues/30) |
| A-3-f | 7 マスタ timestamptz 空文字バグ横展開 fix | 0.6d | 0.5d | [PR #32](https://github.com/Hyuaran/garden/pull/32) ✅ |
| A-3-a | `root_kot_sync_log` migration + 二段階ログ書込 | 0.3d | 0.5d | [PR #34](https://github.com/Hyuaran/garden/pull/34) ✅ |
| A-3-b | `/root/kot-sync-history` UI + 再実行 | 0.5d | 0.5d | [PR #35](https://github.com/Hyuaran/garden/pull/35) ✅ |
| A-3-c | Vercel Cron 自動同期基盤（Fixie 前提） | 0.6d | 0.6d | [PR #39](https://github.com/Hyuaran/garden/pull/39) ✅ |
| A-3-g | employees 外注拡張 + `is_user_active` / `garden_role_of` | 0.5d | 0.4d | [PR #41](https://github.com/Hyuaran/garden/pull/41) ✅ |
| A-3-d | `/daily-workings` 同期 + `root_attendance_daily` | 0.5d | 0.5d | [PR #42](https://github.com/Hyuaran/garden/pull/42) ✅ |
| A-3-h | employees 給与カラム拡張（kou_otsu / dependents_count / deleted_at） | 0.4d | 0.4d | [PR #46](https://github.com/Hyuaran/garden/pull/46) ✅ |
| **合計** | | **3.6d** | **3.7d** | **+0.1d（優秀）** |

### 累計（Phase A-1〜A-3）
- Phase A-1: 1.0d（予定 3.5d、-2.5d 圧縮）
- Phase A-2: 0.5d（予定 1.0d、-0.5d 圧縮）
- Phase A-3: 3.7d（予定 3.6d、+0.1d）
- **総計: 5.2d / 予定 8.1d、-2.9d**（圧縮）

---

## 2. 整備された資産（develop に入っているもの）

### DB スキーマ

```
public.root_kot_sync_log          -- A-3-a 同期履歴（id / sync_type / sync_target / status / records_* / error_*）
public.root_attendance_daily      -- A-3-d 日次勤怠（KoT /daily-workings から）
public.root_employees             -- 拡張済（A-3-g/h）
  + contract_end_on date          -- A-3-g 外注契約終了日
  + kou_otsu text CHECK            -- A-3-h 甲欄/乙欄
  + dependents_count int CHECK     -- A-3-h 扶養家族数 (0〜20)
  + deleted_at timestamptz         -- A-3-h 論理削除
```

### SQL 関数（横断利用可）

```sql
public.is_user_active() returns boolean       -- A-3-g 退職/契約終了/論理削除判定
public.garden_role_of(uid uuid) returns text  -- A-3-g user_id → garden_role
public.root_can_access() / root_can_write()   -- 既存（Phase 1）
public.current_garden_role()                  -- 既存（Phase 1）
public.root_update_updated_at()               -- 既存（Phase 1、trigger 用）
```

### アプリ層

| パス | 内容 |
|---|---|
| `src/app/root/_lib/kot-api.ts` | KoT API クライアント（Bearer / 指数バックオフ / FIXIE_URL ホック） |
| `src/app/root/_lib/kot-sync-log.ts` | sync_log の insert/complete/failure helper |
| `src/app/root/_lib/kot-sync-server.ts` | runMonthlySyncFull / runDailySyncFull / runOrphanedRunningCleanup |
| `src/app/root/_lib/sanitize-payload.ts` | timestamptz 空文字バグ予防の共通サニタイザ（A-3-f） |
| `src/app/root/_lib/validators.ts` | 7 マスタ + 外注 + 給与関連の検証 |
| `src/app/root/_lib/useMasterShortcuts.ts` | FileMaker 風キーボードショートカット |
| `src/app/root/_actions/kot-sync.ts` | previewKotMonthlySync / commitKotSyncResult / commitKotSyncFailure |
| `src/app/root/_actions/kot-sync-rerun.ts` | rerunSync（履歴 UI から失敗を再実行） |
| `src/app/root/kot-sync-history/page.tsx` | 履歴ビューア（admin 専用、自動 refetch、stale 警告） |
| `src/app/api/root/kot-sync/cron-monthly/route.ts` | 月末候補日に走る Cron |
| `src/app/api/root/kot-sync/cron-daily/route.ts` | 毎日 03:00 JST 走る Cron |
| `src/lib/cron-auth.ts` | CRON_SECRET 検証（モジュール横断） |
| `scripts/probe-kot.mjs` | KoT 実機 probe（PII マスキング、employees / monthly / daily） |
| `scripts/check-phase1-migration.mjs` | Phase 1 migration 状態確認 |
| `scripts/root-schema-patch-a3g.sql` | Dashboard 手動実行用（A-3-g） |
| `scripts/root-schema-patch-a3h.sql` | 同（A-3-h） |

### 検証基盤

- Vitest 33 件 pass（`src/app/root/_lib/__tests__/validators.employee.test.ts` 20 件 + `src/app/root/_constants/__tests__/garden-role.test.ts` 13 件）
- `npm run test:run -- src/app/root` で実行可能

### ドキュメント

- `docs/known-pitfalls.md` §[#1] timestamptz 空文字、§2.6 emptyX ファクトリ問題
- `docs/specs/2026-04-24-root-master-definitions.md` 7 マスタ定義書
- `docs/specs/2026-04-24-root-kot-integration-requirements.md` KoT API 連携要件書

---

## 3. 横展開可能な成果物（他モジュール流用 OK）

### TS / API
- `@/lib/supabase/admin` の `getSupabaseAdmin()` — Leaf 先行、Root 採用、他モジュールからも利用推奨
- `@/lib/cron-auth` の `verifyCronRequest` — Bloom 同等実装と将来統合候補
- `src/app/root/_lib/sanitize-payload.ts` の `sanitizeUpsertPayload` / `NULLABLE_DATE_KEYS` — 7 マスタすべての upsert で実績、新マスタ追加時の標準パターン
- `src/app/root/_lib/validators.ts` のプリミティブ群（`isDigits` / `isKatakana` / `isEmail` / `isInRange` 等）

### DB 関数（RLS で参照可）
- `is_user_active()` — Leaf / Bud / Forest の RLS で `using (is_user_active())` の形で利用想定
- `garden_role_of(auth.uid())` — `garden_role_of(auth.uid()) in ('admin','super_admin')` パターン

### UI パターン
- DataTable + Modal + FormField + StatusBadge + useMasterShortcuts のセット
- 二段階モーダル（プレビュー → 確認 → upsert）
- 履歴ビューア（フィルタ + ページング + 自動 refetch + 行クリック詳細）

---

## 4. 残課題

### 🚨 Fixie 契約後の一連作業（最重要）

KoT API は IP 制限ありで Vercel から直接叩けない。Issue #30 で案 B（Fixie 固定 IP プロキシ）採択済。契約後に以下を順次実施：

1. **Fixie 契約**（東海林さん）→ 固定 IP 発行
2. **KoT サポートに許可申請**（東海林さん、固定 IP 追加）
3. **Vercel 環境変数登録**（東海林さん、Vercel Dashboard）
   - `CRON_SECRET`（任意の secret 値、`openssl rand -base64 48` 等）
   - `FIXIE_URL`（Fixie 発行値、`http://user:pass@proxy.usefixie.com:80/`）
   - `KOT_API_TOKEN`（既存値）/ Supabase 各キー（既存値）
4. **`kot-api.ts` の proxy 配線 TODO 解消**（Root セッション）
   - 現状: `FIXIE_URL` 検出時に WARN ログ出して直接 fetch（fail closed）
   - 必要作業: undici `ProxyAgent` または `https-proxy-agent` を新規 npm 追加（要 a-main 承認）
   - `kotFetch` 内の `fetch(...)` に `dispatcher: new ProxyAgent(FIXIE_URL)` を渡す
5. **`vercel.json` の `crons_pending_fixie_root` を `crons` 配列へ移動**（Root セッション）
   - 現状: cron entries は `crons_pending_fixie_root` キーで保留中（Vercel が無視）
   - 移動後 `vercel deploy` で月次・日次 cron がアクティブ化
6. **Vercel Preview で curl 動作確認**
   ```bash
   curl -H "authorization: Bearer $CRON_SECRET" \
     https://<preview>/api/root/kot-sync/cron-daily
   curl -H "authorization: Bearer $CRON_SECRET" \
     https://<preview>/api/root/kot-sync/cron-monthly
   ```
7. **本番デプロイ後の翌朝確認**
   - `/root/kot-sync-history` で `triggered_by='cron'` の log が記録されていること

### probe-kot.mjs 実機フィールド名確認（東海林さん手元）

`KotDailyWorking` 型は spec の推定 camelCase で実装済。実機レスポンスとのズレが Phase A-2 月次で 1 度発覚した経緯あり（同リスク）。

```bash
# 東海林 PC（許可 IP）で実行
cd C:/garden/a-root
node scripts/probe-kot.mjs
# 末尾の daily-workings-YYYY-MM-DD セクションの keys 出力を確認
# _types/kot.ts の KotDailyWorking との差分があれば a-main 経由で Root へ調整依頼
```

### A-3-h migration の Dashboard 適用（東海林さん）

```
Supabase Dashboard > garden-dev > SQL Editor
→ scripts/root-schema-patch-a3h.sql を貼付 → Run
→ ファイル末尾の確認クエリ 2 本で カラム・index の存在確認
→ 既存従業員データの kou_otsu / dependents_count を手動更新（Bud Phase B 着手までに）
```

A-3-g の `scripts/root-schema-patch-a3g.sql` も未適用なら同様に。

### garden-prod migration（Phase A 完走時にまとめて）

A-3 で導入した 4 つの migration は **garden-dev のみ適用想定**：
- `20260425000001_root_kot_sync_log.sql`
- `20260425000002_root_employees_outsource_extension.sql`
- `20260425000003_root_attendance_daily.sql`
- `20260425000004_root_employees_payroll_extension.sql`

Phase A 完走（Phase B 着手前 or 同時）で garden-prod へ一括適用する想定。順番は番号通り。

---

## 5. 次 Phase 候補（a-main 判断待ち）

### 候補 A: Phase B 着手（Root ↔ Bud 連携）
- Bud Phase B（給与計算）/ Phase C（年末調整・源泉徴収）への schema は A-3-g/h で整備済
- Root 側は受け入れ準備完了、Bud 側の進捗待ち
- Root が再関与するのは Bud から RLS / API 仕様の調整依頼が来たタイミング

### 候補 B: 他モジュール支援（Leaf / Forest / Tree の RLS retrofit）
- `is_user_active()` / `garden_role_of()` を活用した既存 RLS の刷新支援
- 現状の各モジュール RLS は個別に書かれている → 共通関数で統一化
- 副次効果: 退職者・外注契約終了者を一括で締め出せる

### 候補 C: Fixie 契約完了 → A-3 本番稼働化（上記「残課題」の 1〜7）
- 東海林さん Fixie 契約後にトリガー
- Root 側の作業: proxy 配線 + vercel.json crons 移動（半日想定）

### 候補 D: 待機
- 他モジュールが稼働中、Root 側は静観
- 緊急対応・hotfix のみ受付

**a-main の指示で次セッション起動時のスコープを決定**

---

## 6. 開発インフラ（次セッションが知るべきこと）

### ブランチ規約
- 新機能: `feature/root-phase-X-Y-<short-desc>` から develop に PR
- ハンドオフ・記録: `docs/root-<topic>` から develop に PR（or 直 commit、軽微なら）

### 検証フロー
```bash
npx tsc --noEmit                         # 型チェック
npm run lint                              # ESLint
npm run test:run -- src/app/root          # Vitest（Root のみ）
npm run dev                               # localhost:3000（preview MCP では :3001）
```

### Supabase 接続（ローカル開発）
- `.env.local` に以下：
  - `NEXT_PUBLIC_SUPABASE_URL`（garden-dev）
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`（garden-dev publishable）
  - `SUPABASE_SERVICE_ROLE_KEY`（garden-dev secret、`getSupabaseAdmin()` で使用）
  - `KOT_API_TOKEN`（KoT 発行、許可 IP からのみ有効）
  - `FIXIE_URL`（未設定可、設定時は警告ログ）
  - `CRON_SECRET`（dev では未設定可、Vercel に登録）

### 既知の落とし穴（known-pitfalls.md 参照）
1. timestamptz 列に空文字 `""` を送ると Postgres が拒否 → `sanitizeUpsertPayload` で除外
2. Route Handler で anon Supabase client を使うと RLS で 404 → JWT 転送 or service_role
3. `emptyX()` ファクトリは `created_at: ""` を返さない（A-3-f で対応済）
4. KoT API の date 形式: `/monthly-workings` は YYYY-MM、`/employees?date` / `/daily-workings` は YYYY-MM-DD
5. KoT API の IP 制限: 契約 IP のみ許可（Vercel 動的 IP は不可、Fixie 必須）

---

## 7. セッション統計

- 開始: 2026-04-24（前セッションから継続）
- 終了: 2026-04-25 早朝
- 担当: a-root（東海林 A アカウント / `C:\garden\a-root`）
- 主担当 PR: #14 / #15 / #32 / #34 / #35 / #39 / #41 / #42 / #46（合計 9 本マージ）
- 主担当 Issue: #30
- 起動: コンテキスト 90% 到達で引退、次セッション起動時に本ファイル冒頭から読込推奨

---

**Phase A-3 完走 🎉 お疲れさまでした。**
