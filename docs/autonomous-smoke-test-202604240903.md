# 自律実行モード スモークテスト - a-auto

- 発動時刻: 2026-04-24 09:03
- シーン: 集中別作業中（約10分）
- 作業ブランチ: `feature/auto-smoke-test-20260424`
- 目的: a-auto セッションの起動・コンテキスト把握・ドキュメント生成の一連フロー検証（既存ファイル改変ゼロ）

---

## a. ディレクトリ構造サマリ（a-auto フォルダ、主要20件）

| # | パス | 種別 | 概要 |
|---|---|---|---|
| 1 | `.claude/settings.json` | 設定 | プロジェクト共通の allow/deny 権限 |
| 2 | `.claude/settings.local.json` | 設定 | ローカル追加 allow（`git checkout *`） |
| 3 | `.claude/worktrees/zealous-gould-6c4f7f` | 作業領域 | 既存 worktree 1件 |
| 4 | `.env.local` | 秘匿 | Supabase 接続情報（Git除外済み） |
| 5 | `.gitignore` | Git | 除外設定 |
| 6 | `AGENTS.md` | 指示 | Next.js 破壊的変更の注意 |
| 7 | `CLAUDE.md` | 指示 | プロジェクト共通ルール（§11–§13含む） |
| 8 | `README.md` | 文書 | プロジェクト概要 |
| 9 | `docs/auth/login-implementation-guide.md` | 文書 | 認証実装ガイド |
| 10 | `docs/effort-tracking.md` | 実績 | §12 作業工程蓄積ファイル |
| 11 | `docs/handoff-20260422.md` / `handoff-20260423*.md` (計4) | ハンドオフ | セッション間引き継ぎ |
| 12 | `docs/superpowers/plans/` | 計画 | Shinkouki A1 / Forest A2-A3 |
| 13 | `docs/superpowers/specs/` | 仕様 | Shinkouki auto-update 設計 |
| 14 | `docs/superpowers/reviews/` | レビュー | Forest Phase A review |
| 15 | `docs/_new_section_13_temp.md` | 一時 | §13 改訂用テンプファイル |
| 16 | `src/app/{api,forest,root,tree}` | コード | Next.js App Router 配下の実装モジュール |
| 17 | `src/app/layout.tsx` / `page.tsx` / `globals.css` | コード | ルートレイアウト・エントリ・全体CSS |
| 18 | `public/*.svg` | アセット | next/vercel/globe/file/window のロゴ |
| 19 | `scripts/forest-schema*.sql` / `root-schema.sql` / `seed-*` | SQL/seed | DBスキーマ・シード投入 |
| 20 | `eslint.config.mjs` / `next.config.ts` / `tsconfig.json` / `postcss.config.mjs` / `package.json` | 設定 | ビルド/型/Lint/Tailwind の各設定 |

補足: `src/app` には現状 `api/`, `forest/`, `root/`, `tree/` が存在（CLAUDE.md 記載の9モジュールのうち、他モジュールは未作成またはフィクスチャ段階）。

---

## b. CLAUDE.md §11–§13 読み込み確認（要旨1行）

| 節 | 見出し | 要旨1行 |
|---|---|---|
| §11 | 横断調整セッション運用（2026-04-23追加） | a-main が全モジュール横断の指示・整合性調整を担い、恒久ルールは CLAUDE.md/MEMORY.md、一時指示はテンプレート形式で手動配布する運用を規定。 |
| §12 | 作業工程の実績蓄積ルール（2026-04-23追加） | 各セッションが `docs/effort-tracking.md` に「日付/モジュール/タスク/予定/実績/差分/理由/担当」を追記し、a-main が進捗を即答できる体制を維持。 |
| §13 | 自律実行モード（2026-04-24改訂） | a-auto セッション専用。ユーザー不在時間に対象モジュールの `feature/*` ブランチで低リスク作業を進め、`autonomous-report-*-a-auto-<mod>.md`・a-auto集約サマリ・周知メッセージを出力。main/develop 直接 push や設計判断は禁止・即停止。 |

---

## c. `.claude/settings.json` / `settings.local.json` 全エントリ列挙

### settings.json — allow（12件）
1. `mcp__Claude_Preview__preview_click`
2. `mcp__Claude_Preview__preview_console_logs`
3. `mcp__Claude_Preview__preview_eval`
4. `mcp__Claude_Preview__preview_fill`
5. `mcp__Claude_Preview__preview_list`
6. `mcp__Claude_Preview__preview_logs`
7. `mcp__Claude_Preview__preview_resize`
8. `mcp__Claude_Preview__preview_screenshot`
9. `mcp__Claude_Preview__preview_snapshot`
10. `mcp__Claude_Preview__preview_start`
11. `mcp__Claude_Preview__preview_stop`
12. `mcp__ccd_session__mark_chapter`

### settings.json — deny（12件）
1. `Bash(git branch -D*)`
2. `Bash(git clean -f*)`
3. `Bash(git clean -fd*)`
4. `Bash(git push --force*)`
5. `Bash(git push -f*)`
6. `Bash(git reset --hard*)`
7. `Bash(rm *)`
8. `Bash(rm:*)`
9. `Bash(rmdir *)`
10. `PowerShell(Remove-Item*)`
11. `PowerShell(del *)`
12. `PowerShell(rm *)`

※ 起動確認時に「13件」と報告したが正しくは **12件**（訂正）。

### settings.local.json — allow（1件）
1. `Bash(git checkout *)`

deny: 無し。

---

## d. 想定される初回本番タスク候補（3案）

1. **effort-tracking の遡及整備＆先行記入**
   §12 の「初回導入時の対応」に基づき、`docs/effort-tracking.md` へ把握可能な過去タスク（Forest Phase A / Shinkouki A1 / Tree 認証）の実績を追記し、直近予定タスクを予定時間付きで先行記入する。低リスクかつ判断不要で完結しやすい。

2. **handoff-*.md / wip-*.md の日次自動サマリ生成**
   `docs/handoff-20260422.md` ～ `handoff-20260423-*.md` を横断的に要約し、a-main 朝次レビュー用のダイジェスト（未完了タスク・ブランチ状態・判断保留事項の抽出）を `docs/digest-YYYYMMDD.md` に出力。a-main の初動を高速化。

3. **軽量テスト追加（動作不変リファクタ範囲内）**
   §13 の「動作を変えない範囲」に該当する、Forest/Tree/Root の純粋関数・ユーティリティに対するユニットテスト雛形の追加。既存コードには触れず `__tests__/` 配下に追加のみ。5時間枠の夜間バッチに向く初回検証タスクとして適している。
