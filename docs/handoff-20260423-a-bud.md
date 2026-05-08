# Handoff — 2026-04-23（設定再反映のため一時退避 / a-bud (A)）

## 今やっていること
- Garden-Bud Phase 1b.2 振込管理 UI 実装（プラン `docs/superpowers/plans/2026-04-23-bud-phase-1b2-ui.md`、全 13 タスク）
- 2026-04-23 午後に a-bud セッションで B→A 引き継ぎ後に再開、Task 4-5 を完了させ push 済み

## 進捗（5/13 完了）
- ✅ Task 1: StatusBadge / status-display（B 側 commit 済）
- ✅ Task 2: FilterBar（B 側 commit 済）
- ✅ Task 3: MonthlySummary（B 側 commit 済）
- ✅ Task 4: 振込一覧画面 `/bud/transfers`（`53a9c16`）
- ✅ Task 5: フォーム入力バリデーション TDD・9 tests 緑（`99f5b4e`）
- ✅ effort-tracking.md に Phase 1b.2 進捗反映（`b2d2319`）
- 🟡 Task 6: 通常振込 新規作成画面 + フォームコンポーネント（未着手、次に実施）
- 🟡 Task 7-13: 未着手

## 次にやるべきこと
**最優先**: Task 6 の実装（プラン行 936-1497、Phase 1b.2 で最大）
- ファイル 5 個を新規作成:
  - `src/app/bud/transfers/_components/TransferFormRegular.tsx`（Client）
  - `src/app/bud/transfers/_components/DuplicateWarning.tsx`
  - `src/app/bud/transfers/_components/BankPicker.tsx`（会社×銀行口座選択）
  - `src/app/bud/transfers/_components/KanaPreview.tsx`（半角カナ変換プレビュー）
  - `src/app/bud/transfers/new-regular/page.tsx`
- 実装方針はユーザー未確定（A 案 subagent-driven / B 案 分割直接 / C 案 プラン逐一）
  - 再起動後、まずユーザーに方針を再確認すること

Task 6 以降の順番:
1. Task 6 通常振込 新規作成
2. Task 7 キャッシュバック 新規作成
3. Task 8 Server Actions（createTransferAction 等）
4. Task 9 振込詳細画面 + StatusActionButtons
5. Task 10 CSV 出力画面（super_admin 専用）
6. Task 11 BudShell メニューに「振込管理」追加
7. Task 12 手動動作確認手順書
8. Task 13 工数実績記録

## 注意点・詰まっている点

### ⚠️ 東海林さん手動作業が前提条件（Phase 1b.1 から継続）
以下 2 ファイルを Supabase Dashboard → SQL Editor で適用が必要。未適用だと Task 12 手動動作確認ができない:
- `scripts/bud-transfers-v2.sql`（Phase 1b.1 Task 0）
- `scripts/bud-rls-v2.sql`（Phase 1b.1 Task 1）

### 🔧 横断調整セッション運用（2026-04-23 開始）
- 本セッション（a-bud）は Garden Bud 実装専用
- 横断判断は「【横断セッション(a-main)からの共有】」で届く
- 応答ルール:
  - 選択肢はテキスト内で A 案 / B 案 形式、AskUserQuestion UI 禁止
  - トークン残 50% 以下で冒頭 `【重要】現在のトークン残り：〇〇％`
  - 作業区切りごとに `docs/effort-tracking.md` 追記 → commit & push
  - JS コード提案時はコメント全削除（依頼時のみ解説付き再送）
  - 非破壊・バックアップルールあり（ただし git 管理コードは commit が履歴）

### 💡 重要な設計判断（既決・Phase 1b.1 から継続）
- **振込 ID 形式**: 通常 `FK-YYYYMMDD-NNNNNN` / CB `CB-YYYYMMDD-G-NNN`（Kintone 既存運用継承）
- **6 段階ステータス**: 下書き → 確認済み → 承認待ち → 承認済み → CSV出力済み → 振込完了（+差戻し）
- **super_admin スキップ**: 自起票の即承認で `confirmed_by/at` は NULL のまま残す（I-2 B 案採用）
- **社内立替対応**: `request_company_id` と `execute_company_id` を分離
- **重複検出**: PostgreSQL GENERATED 列（duplicate_key）+ TypeScript 側同ロジック

## 関連ファイル・ブランチ

### ブランチ
- **作業ブランチ**: `feature/bud-phase-0-auth`（origin 最新と同期、`b2d2319` まで push 済）
- **ベース**: `develop`

### プラン / 仕様
- プラン: `docs/superpowers/plans/2026-04-23-bud-phase-1b2-ui.md`（本セッションで実行中）
- 設計書: `docs/superpowers/specs/2026-04-22-bud-design-v2.md`（Phase 0〜6）
- 工数実績: `docs/effort-tracking.md`
- 前回ハンドオフ: `docs/handoff-20260422-b.md`（B→A 引き継ぎ、2026-04-22〜23）

### Phase 1b.2 で完成済みのファイル
- `src/app/bud/transfers/_components/StatusBadge.tsx`
- `src/app/bud/transfers/_components/FilterBar.tsx`
- `src/app/bud/transfers/_components/MonthlySummary.tsx`
- `src/app/bud/transfers/_lib/status-display.ts`
- `src/app/bud/transfers/_lib/__tests__/status-display.test.ts`
- `src/app/bud/transfers/_lib/transfer-form-schema.ts`
- `src/app/bud/transfers/_lib/__tests__/transfer-form-schema.test.ts`
- `src/app/bud/transfers/page.tsx`

### 依存（Phase 1b.1 Foundation 完成済み）
- `src/app/bud/_constants/transfer-status.ts`
- `src/app/bud/_lib/transfer-id.ts`
- `src/app/bud/_lib/duplicate-key.ts`
- `src/app/bud/_lib/transfer-queries.ts`
- `src/app/bud/_lib/transfer-mutations.ts`
- `scripts/bud-transfers-v2.sql`（東海林さん適用待ち）
- `scripts/bud-rls-v2.sql`（東海林さん適用待ち）

## 担当セッション名
- **a-bud (A)**（mikoto.a82@gmail.com / 東海林 A / 個人 Max 20x）
- 2026-04-23 午後: B→A 引き継ぎ完了し、Task 4-5 を追加実装

## 再起動後の最初の一声
> Task 6（通常振込 新規作成）から再開してください。実装方針は A/B/C どれでいきますか？（推奨 A 案: subagent-driven）
