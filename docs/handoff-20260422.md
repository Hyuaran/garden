# Handoff - 2026-04-22 (a-bud / A)

## 今やっていること

Garden-Bud Phase 0（認証基盤）の実装が完了。`feature/bud-phase-0-auth` を origin に push 済み。東海林さんの手動作業（SQL適用・PR作成・動作確認）待ち。

## 次にやるべきこと

### 東海林さん側の手動作業（このセッション以外で完結）

1. **Supabase Dashboard → SQL Editor** で以下を順番に適用：
   - `scripts/bud-schema.sql`
   - `scripts/bud-rls.sql`
   - `scripts/seed-bud.sql`
2. **GitHub で PR 作成**: https://github.com/Hyuaran/garden/pull/new/feature/bud-phase-0-auth
3. **動作確認**:
   - `cd C:\garden\a-bud && npm run dev`
   - `/bud/login` で社員番号 0008 + Forest 用パスワードでログイン
   - `/bud/dashboard` 表示・スマホドロワー・ログアウト動作確認

### 引き継ぎ後のセッション作業

- **Phase 0 レビュー対応**: PR にレビュー指摘が入ったら `feature/bud-phase-0-auth` で修正
- **Phase 1 着手**: 振込管理 CRUD + 承認フロー + 銀行CSV出力
  - 新ブランチ名: `feature/bud-phase-1-transfers`（develop から分岐、Phase 0 マージ後に着手）
- **v2 設計書の 7段階ロール更新の再適用**: 旧 `C:\Users\shoji\Desktop\garden` 上の `feature/bud-design` ブランチでコミット `cb9c7c9` として更新したが、引越しで失われた可能性あり。Phase 1 着手前に確認・必要なら再更新

## 注意点・詰まっている点

- **v2 設計書の紛失リスク**: 先述の通り `feature/bud-design` ブランチの 7段階更新コミット（cb9c7c9）が origin に push されていない。a-main などで該当ブランチが残っていれば救出、無ければ docs/superpowers/specs/2026-04-17-bud-design-v2.md を手動で 7段階に更新し直す
- **1ディレクトリ1セッション鉄則**: 本セッションは a-bud 専用。a-main ほか他ディレクトリには触れていない
- **Task 2 (Root前提SQL) はスキップ済**: develop の `scripts/root-auth-schema.sql`（Tree Phase A で既にマージ済み）が Bud の前提条件（birthday / garden_role / user_id カラム追加）を全て含んでおり、Bud 独自の prerequisite SQL は作成不要だった
- **ESLint / tsc --noEmit** 共に Bud 配下 0 エラーで動作確認済み（Tree 既存コードには既存の lint エラーあり、本 PR 対象外）

## 関連情報

- **ブランチ**: `feature/bud-phase-0-auth`（origin push 済、develop から 2コミット先行）
- **コミット履歴**:
  - `8b75f35` feat(bud): Phase 0 認証基盤のフロントエンド実装（12ファイル）
  - `5916c6a` feat(bud): Bud スキーマ・RLS・シードSQL を追加（SQL 3本 + .gitignore）
- **PR**: 未作成。https://github.com/Hyuaran/garden/pull/new/feature/bud-phase-0-auth で東海林さんが作成予定
- **関連ファイル**（今PRの成果物）:
  - `scripts/bud-schema.sql` / `scripts/bud-rls.sql` / `scripts/seed-bud.sql`
  - `src/app/bud/_constants/{types,roles}.ts`
  - `src/app/bud/_lib/{supabase,auth,queries}.ts`
  - `src/app/bud/_state/BudStateContext.tsx`
  - `src/app/bud/_components/{BudGate,BudShell}.tsx`
  - `src/app/bud/{layout,page}.tsx`
  - `src/app/bud/login/page.tsx`
  - `src/app/bud/dashboard/page.tsx`
- **参照済みドキュメント**:
  - 親 CLAUDE.md（015_Gardenシリーズ/CLAUDE.md）§4 認証ポリシー — 7段階ロール定義
  - MEMORY `project_garden_auth_policy` — 7段階ロール改訂 2026-04-21
  - develop の `scripts/root-auth-schema.sql` — current_garden_role / root_can_write / root_is_super_admin の再利用元
  - Tree 実装（`src/app/tree/`）— auth.ts / supabase.ts / TreeStateContext / TreeAuthGate のパターンを踏襲
- **未決事項（Phase 3 着手前に要相談）**:
  - 手渡し現金給与支給者の管理方法（memory: `project_bud_cash_payment_issue`）

## Supabase 状態

- `scripts/root-auth-schema.sql` は **Tree Phase A で既に適用済み**（develop マージ時に済）
- `scripts/bud-schema.sql` / `bud-rls.sql` / `seed-bud.sql` は **未適用**（東海林さんの対応待ち）
- 期待される Bud テーブル: `bud_users` / `bud_transfers` / `bud_statements` / `bud_salary_batches` / `bud_salary_details`
- 期待されるヘルパー関数: `bud_has_access()` / `bud_is_approver_or_above()` / `bud_is_admin()`

## Phase 完了状況

- ✅ Phase 0 認証基盤（実装完了・push済・動作確認待ち）
- ⏳ Phase 1 振込管理（未着手、Phase 0 マージ後に着手）
- ⏳ Phase 2 入出金明細（未着手）
- ⏳ Phase 3 給与処理（未着手、手渡し現金支給の未決事項あり）
