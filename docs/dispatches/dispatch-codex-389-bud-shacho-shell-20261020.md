# Codex-389：Bud の外枠を社長スタイルに（BudShachoShell）（2026-10-20）

## 正本（必ず読む）
- 設計：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\100_Projects\110_Garden\070_Bud_経理収支\040_設計_口座残高とカード利用_MF連携_v1_20261020.md` の §5
- 社長スタイルの決まり：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md`
- 手本の外枠：`src/app/system/_components/ShachoShell/ShachoShell.tsx`（System）・`src/app/root/_components/RootShell.tsx`（Root）・`src/app/rill/_components/RillShachoShell.tsx`（Rill）。**Root・Rill と同じやり方**で Bud 用を作る
- 新ロゴ：`src/app/_components/ModuleIcon/ModuleIcon.tsx`
- ベル：`src/app/_components/notices/NoticeBell.tsx`（`className` に外枠のアイコンボタンの class を渡すと同じ大きさになる）

## 今の Bud
- 外枠が 3 種類混在：`src/app/bud/_components/BudShell.tsx`（古い）・`BudGardenFrame.tsx`／`BudFaithfulFrame.tsx`（GardenShell＝旧 Garden スタイル・明朝・クリーム）
- メニュー：`src/app/bud/_components/bud-garden-menu.ts`（ダッシュボード／入金管理／請求書管理／経費精算／給与管理／振込管理／仕訳帳／損益管理／区切り線／銀行口座管理／マスタ管理／監査ログ／設定）
- 画面一覧：dashboard・receivables・invoices・expenses（expenses/review 含む・**本番で使用中**）・payroll・transfers（csv-export・new-cashback・new-regular・[transfer_id]）・journal・shiwakechou・profit・statements（imports・summary）・bank・masters・audit・settings
- ゲート：`bud/layout.tsx`（BudStateProvider・BudModuleGateWrapper）

## 画面の絵（PC）
```
┌──┬────────────┬──────────────────────────────────────┐
│新 │ Bud            │  Bud ／ 経費精算             東海林さん [ベル][テーマ][ログアウト] │
│ロ │ 経理・収支      │  ┌──────────────────────────────┐   │
│ゴ │ ─────────── │  │ （今の各画面の中身）                    │   │
│の │ ダッシュボード   │  │                                      │   │
│列 │ 入金管理         │  └──────────────────────────────┘   │
│   │ … 区切り …      │                                              │
│   │ 銀行口座管理     │                                              │
└──┴────────────┴──────────────────────────────────────┘
```
スマホ：上の帯（木のマーク＋Bud・ベル・三本線）＋メニューは三本線から（System の ShachoShell のスマホと同じ）

## 作るもの
1. `src/app/bud/_components/BudShachoShell/`（BudShachoShell.tsx・module.css・テスト）：System の ShachoShell と同じ見た目・動き（左端のモジュールの列は新ロゴ、左のメニュー、右上に利用者名・ベル・テーマ切替・ログアウト、スマホの上の帯）。メニューは bud-garden-menu.ts の項目と並び（アイコンは線画の SVG。絵文字・旧 orb 画像は使わない）。今いる画面を強調
2. `src/app/bud/layout.tsx`（または `/bud/login` を除く layout）で全 Bud 画面を BudShachoShell で包む。各画面の `BudShell`／`BudGardenFrame`／`BudFaithfulFrame` の**外枠部分（ヘッダー・サイドバー）だけ**を外し、中身はそのまま出す。BudFaithfulFrame の見本の中身（旧スタイルの HTML）は今回はそのままでよい（第 2 段で 1 画面ずつ社長スタイルにする）
3. 社長スタイルの外枠は背景を `::before` で画面全体に塗る・ダークは `.dark`／`[data-theme="dark"]` で見出しを別の色に（コントラスト 大見出し 3:1・本文 4.5:1 以上）。Garden 共通の CSS 変数は書き換えない
4. `/bud/login` は外枠なし（今のまま）

## 守ること
- **commit・push しない。DB に接続しない**（画面の確認は Claude がする）
- 経費精算（expenses・expenses/review）・振込管理など**中身の動きは変えない**。外枠を変えたことで中身の幅・高さ・スクロールが崩れないようにする
- 画面の文言に開発者用語を書かない。絵文字を使わない
- `npx vitest run src/app/bud src/app/_components` と `npx tsc --noEmit -p .` が通ること（前から落ちているテスト AppHeader・KpiCard・BackgroundCarousel は触らない）

## 報告（日本語・コードブロック）
- 作った・変えたファイル
- テストの結果
- Claude が画面で確かめる URL の一覧
