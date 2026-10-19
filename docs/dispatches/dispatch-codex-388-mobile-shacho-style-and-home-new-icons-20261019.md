# Codex-388：スマホ画面の社長スタイル化（三本線メニュー・線画の下メニュー）＋ホームのモジュールカードを新ロゴに（2026-10-19）

## 正本（必ず全文を読む）
- 設計：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\100_Projects\110_Garden\150_System_システム\09_スマホ画面の社長スタイル化\001_設計_スマホ画面の社長スタイル化とホームの新ロゴ_v1_20261019.md`（画面の絵あり）
- 社長スタイルの決まり：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md`
- 手本の CSS：`src/app/system/call-metrics/call-metrics.module.css`
- 新ロゴ：`src/app/_components/ModuleIcon/ModuleIcon.tsx`（`ModuleIcon`・`RailIcon`・`MODULE_META`）。使い方の例＝`src/app/system/_components/ShachoShell/ShachoShell.tsx` の左端の列

## 作るもの
1. **スマホ共通の見た目**：`src/app/m/` の全ページ（ホーム・todo・news・account・search・bud（drive・submit・CameraCapture）・nhk）を社長スタイルにそろえる。色・フォントはスマホ用に 1 か所へまとめ（`m/_lib/mobile-theme.ts` を置き換えるか `m/mobile.module.css` を作る）、明朝・クリーム（#f7f4ec 等）・Garamond はやめる。ライト／ダーク両方（`.dark`・`[data-theme="dark"]`）。背景は `::before` で画面全体を塗る。Garden 共通の CSS 変数は書き換えない
2. **上の帯**（`m/layout.tsx`）：左に木のマーク（`/themes/garden-shell/images/login/mark-tree-emblem.png`）＋「Garden」、右に今のベル（`NoticeBell`）と**三本線のボタン**。押すと右上からメニュー：利用者名・役職／明るい表示・暗い表示（PC 版のテーマ切替と同じ仕組みを使う＝`ThemeProvider` の切替。今の方に印）／ログアウト（PC 版の ShachoShell と同じ処理を使う）。外側・Esc・もう一度押すで閉じる。キーボードと読み上げに対応（aria-expanded 等）
3. **下のメニュー**（`m/_lib/mobile-nav.ts`・`MobileBottomNav.tsx`）：絵文字をやめて線画の SVG（家・虫めがね・チェック・ベル・人。太さ・角は ShachoShell のアイコンに合わせる）。**文字は画面に出さない**（aria-label だけ持つ）。今いる画面はティール＋下に小さな線。バッジ（99+）はそのまま
4. **スマホのホーム**（`m/page.tsx`）：タイルのロゴを `/themes/module-icons/*.webp` から `ModuleIcon` に。使えないモジュールは今どおり薄く
5. **PC のホーム**（`src/app/_components/home/GardenHomeClient.tsx` の `ModuleCard`）：手書きの SVG を `ModuleIcon`（System は `RailIcon` と同じもの）に置き換える。並び・文言・リンクは変えない
6. 画面の中の絵文字・記号（bud の ⚠ ✓ ✕、‹ › 等）を線画の SVG に
7. テスト：三本線のメニューの開閉・テーマ切替・ログアウトを呼ぶこと、下メニューに文字が出ないこと（aria-label はある）、ホームのカードが ModuleIcon を使うこと。既存のスマホ・ホームのテストを合わせる

## 守ること
- **commit・push しない。DB に接続しない**（画面の確認は Claude がする）
- スマホの各画面の動き（経費の提出・撮影・NHK 報告の送信・やることの件数の数え方）は変えない。見た目だけ
- PC の System（ShachoShell）・お知らせ（`src/app/_components/notices/`）の動きは変えない（お知らせ一覧はスマホでも同じ部品のまま。スマホ側の余白・色だけ合わせてよい）
- 画面の文言に開発者用語を書かない
- `npx vitest run src/app/m src/app/_components/home src/app/_components/notices src/app/page.test.tsx` と `npx tsc --noEmit -p .` が通ること（前から落ちているテスト AppHeader・KpiCard・BackgroundCarousel は触らない）

## 報告（日本語・コードブロック）
- 作った・変えたファイル
- テストの結果
- Claude が画面で確かめる手順（見る URL の一覧）
