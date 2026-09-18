# Codex-342 Root を社長スタイルに（第 1 段）：枠を System と同じに・色定義を社長スタイルの変数に・メニューの絵文字を線画アイコンに

作成日: 2026-09-18
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認・完了報告に書く）
**git は触らないこと（commit するな）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。migration は不要。触ってよいのは `src/app/root/` 配下（下の「触らないもの」を除く）とそのテストだけ。`src/app/system/` と `src/app/_components/` は読むだけ（import して使うのは可・書き換えは不可）。**

必ず先に読むもの：
- 見た目の正本：C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md（§2 の変数・§3 の守ること 6 点）
- 見本（System の枠）：`src/app/system/_components/ShachoShell/ShachoShell.tsx`・`shacho-shell.module.css`・`SidebarNavigation.tsx`・`shacho-shell-config.ts`（`MenuIcon` の線画のタッチ＝viewBox 24・stroke 1.7・fill none・round）
- 今の Root の枠：`src/app/root/layout.tsx`・`_components/RootShell.tsx`・`UserHeader.tsx`・`RootGate.tsx`・`_constants/colors.ts`・`_constants/types.ts` の `MASTER_MENUS`・`src/app/root/page.tsx`（Root のホーム）

## 0. 何をするか（東海林さん 2026-09-18）

「Root 全体を System のように社長スタイルに変身させたい。左端にモジュールアイコンも置く。メニューのアイコンは絵文字を使わず社長スタイルの線画に」。Root はまだ現場に展開していないので本番に出してよい。**変えるのは見た目（枠・色・フォント・アイコン）だけ。データ・権限の判定・ログインの仕組み・画面の文言と機能・メニューの並びと呼び名は変えない。**

Root は全画面がインラインの style で `colors.*`（`_constants/colors.ts`）を参照している（321 か所）。直書きの色は 22 か所だけ。だから **`colors.ts` の値を CSS 変数（`var(--root-…)`）に差し替え、変数を枠の CSS でライト／ダーク定義する**のが筋（画面側の 321 か所は書き換えない）。

## 1. 画面（枠）

```
┌──┬────────────────┬──────────────────────────────────────────────┐
│S │ [樹] Garden      │                          東海林 美琴さん [☀][⇥] │
│─ │ Root ／ 組織台帳  │  従業員マスタ                                   │
│🅑 │                 │  給与処理対象者。退職時は…                        │
│🅕 │ メニュー         │  ┌────────────────────────────────────────┐  │
│… │ ▢ ホーム         │  │ ID  社員番号  氏名  カナ  住所  法人 …        │  │
│🅡◀│ ▢ 届出受信箱     │  │ …                                        │  │
│… │ ▢ 雇用契約書     │  └────────────────────────────────────────┘  │
│  │ ▢ 法人マスタ     │                                                │
│  │ ▢ 銀行口座マスタ  │                                                │
│  │ ▢ 取引先マスタ    │                                                │
│  │ ■ 従業員マスタ    │  ← 選択中はティールの塗り                         │
│  │ ▢ 口座の点検     │                                                │
│  │ ▢ 権限一覧       │                                                │
│  │ ▢ 給与体系マスタ  │                                                │
│  │ ▢ 社会保険マスタ  │                                                │
│  │ ▢ 勤怠データ     │                                                │
│  │ ▢ KoT 同期履歴   │                                                │
│  │ ───────────── │                                                │
│  │ (東) 東海林 美琴  │                                                │
│  │     全権管理者    │                                                │
└──┴────────────────┴──────────────────────────────────────────────┘
 左端＝モジュールのアイコン列（System と同じ絵・同じ並び。Root が選択中）
```

- **左端のアイコン列（rail）**：System の `ShachoShell` と同じ部品・同じ並び（いちばん上に System のアイコン → 区切り → `GARDEN_SHELL_MODULES` のうち `getVisibleModules(role)` に入っているもの）。**Root のアイコンが選択中（`current`）**、System は選択なし。ホバーの吹き出し（名前＋役割「組織台帳」）も同じ
- **左メニュー（side）**：上に「[樹のマーク] Garden」（`/` へ）＋その下に小さく「Root ／ 組織台帳」。メニューは先頭に「ホーム」（`/root`）を足し、あとは `MASTER_MENUS` の今の並び・呼び名のまま（`adminOnly` は今と同じく admin 以上だけ）。選択中はティールの塗り。下に利用者（頭文字の丸・氏名・役職 `GARDEN_ROLE_LABELS`）
- **右上（actions）**：「◯◯さん」＋ライト／ダーク切替（`useTheme`）＋ログアウト。**ログアウトは Root の `signOut("manual")`（`useRootState`）を使う**（Root は監査ログを書くので System の logout を流用しない）。今の `UserHeader`（上の白い帯・👤）は廃止
- **本文（main）**：Root は横に広い表が多いので **幅の上限（1180px）は付けない**。余白は System と同じ（30px 40px 60px）。右上の actions と `PageHeader` の右側のボタンが重ならないこと（`PageHeader` の上に actions ぶんの余白を取る）
- スマホ幅は System と同じ縮み方（640px 以下で rail を隠す）
- System の CSS（`shacho-shell.module.css`）は **import してそのまま使ってよい**（rail・side・nav・who・actions・iconButton のクラス）。Root だけの上書き（幅の上限なし等）と下の色変数は `src/app/root/_components/root-shell.module.css` に書く。System 側のファイルは書き換えない

## 2. 色（`colors.ts` を変数に）

`_constants/colors.ts` のキーは**そのまま**、値を `var(--root-…)` にする。変数は `root-shell.module.css` の枠のクラスで定義（ライト＝既定、ダーク＝`:global([data-theme="dark"])`）。

| キー | ライト | ダーク |
|---|---|---|
| primary／primaryDark | `#0ea5a0`／`#0b7e7a`（ティール。主ボタン） | 同じ |
| primaryLight | `#e6f6f5` | `#12343a` |
| accent／accentLight | `#0ea5a0`／`#bfe9e6` | `#0ea5a0`／`#1d4f54` |
| bg | `#f4f5f7` | `#0c1726` |
| bgPanel | `#ffffff` | `#152438` |
| bgSidebar／bgSidebarHover | `#0f1f36`／`#1e3252` | 同じ |
| text | `#17212e` | `#edf4fb` |
| textMuted | `#5a6b80` | `#b7c5d4` |
| textOnDark／textOnDarkMuted | `#ffffff`／`#8ea3c0` | 同じ |
| border／borderStrong | `#e3eaf3`／`#c9d5e3` | `#31435a`／`#47607f` |
| success／successBg | `#15803d`／`#e7f6ec` | `#6ee7a0`／`#12351f` |
| warning／warningBg | `#b45309`／`#fff4e0` | `#fbbf6b`／`#3b2a10` |
| danger／dangerBg | `#c62828`／`#fdecec` | `#ff8a8a`／`#3d1a1a` |
| info／infoBg | `#1d6fb8`／`#e6f1fb` | `#8cc4f5`／`#15304a` |
| disabled／disabledBg | `#8a97a8`／`#eef1f5` | `#8493a5`／`#1c2c42` |

- 見出し用に `heading`（ライト `#10233f`／ダーク `#c8d6ea`）を **足す**（既存キーは消さない）。`PageHeader` の h1 と `Modal` の題は `colors.heading` に
- 枠のクラスに **`font-family` の社長スタイル（ゴシック）** と **`::before{content:"";position:fixed;inset:0;z-index:-1;background:var(--root-bg)}`** を必ず入れる
- `danger` の主ボタンは白文字のままで読めること（ダークの danger ボタンは背景 `#c62828` 固定でよい＝`dangerSolid` を足して `Button` の danger に使う）
- コントラスト：本文・補助は 4.5:1 以上、大きな見出しは 3:1 以上（ライト／ダークとも）。完了報告に主要な組み合わせの比を書く
- `colors` を文字列連結で透明度付きにしている箇所（`${colors.x}33`）は var() では壊れるので、`color-mix` か専用の変数に直す（今は `RootShell.tsx` に 1 か所だけ＝新しい枠で消える）
- **ログインしていないときの画面**（`RootGate.tsx` の「もう一度ログインしてください」）は枠の外なので、同じ変数のクラスを当てて社長スタイルに（🌱 は樹のマーク画像か線画に。文言は変えない）

## 3. メニューのアイコン（絵文字をやめる）

`MASTER_MENUS` の `icon`（絵文字・「点」「権」の文字）を**アイコンの種類名**に変え、Root 用の `RootMenuIcon`（System の `MenuIcon` と同じタッチの線画 SVG）で描く。左メニューと Root のホームのカードの両方で使う。

| 画面 | 種類名 | 絵の内容 |
|---|---|---|
| ホーム | home | 家（System と同じ） |
| 届出受信箱 | inbox | 受け皿に下向き矢印 |
| 雇用契約書 | document | 書類（System と同じ） |
| 法人マスタ | building | ビル |
| 銀行口座マスタ | bank | 柱のある銀行の建物 |
| 取引先マスタ | partner | 握手ではなく、2 つの人型が線でつながる |
| 従業員マスタ | person | 人（System と同じ） |
| 口座の点検 | check | 虫めがねにチェック |
| 権限一覧 | key | 鍵 |
| 給与体系マスタ | salary | 通貨の記号（System と同じ） |
| 社会保険マスタ | shield | 盾 |
| 勤怠データ | calendar | カレンダー |
| KoT 同期履歴 | sync | 回る 2 本の矢印 |

- Root のホーム（`/root`）：カードの大きな絵文字を、ティールの丸角バッジ＋線画アイコンに（System「資料」の `bookBadge` と同じ見せ方）。「旧UI・新UI切替予定」のバッジ（`LegacyUiNotice`）は外す
- 型 `MasterMenu.icon` は種類名の union に。`icon` を文字として描いている箇所が他に無いか確認する

## 4. 触らないもの
- `contracts/_lib/employment-contract-pdf.server.tsx`（契約書 PDF の中の色・記号は帳票なのでそのまま）
- `login/page.tsx`（共通ログインへ転送するだけの画面）・`*.legacy-*`
- `RootGate` の判定・`RootStateContext`・`SessionWarningModal` の動き・各画面の機能と文言
- 第 2 段（Codex-343）でやること：共通部品（Button・DataTable・Modal・FormField・PageHeader・StatusBadge）の形の仕上げ、各画面に残る直書きの色と絵文字（kot-sync-history の ⚠・SyncLogDetailModal の 💡・SessionWarningModal の ⚠ など）。**今回は色変数が効けばよい**

## 5. テスト（vitest・全部緑にしてから完了報告）
- 新しい枠：rail が出て Root が `current`・System は current でない／左メニューに「ホーム」＋今の 12 項目（`adminOnly` は canWrite のときだけ）／絵文字が 1 つも無い（メニューの文字列に絵文字の範囲の文字が含まれない）／選択中の項目に `aria-current="page"`／ログアウトで `signOut("manual")` が呼ばれる／テーマ切替ボタンがある
- `colors.ts`：全キーが `var(--root-` で始まる・`heading` がある
- 既存の Root のテストが全部通る（`role-edit-ui.test.tsx` ほか。枠の変更で壊れたら直す）
- `npx tsc --noEmit`・`npx vitest run src/app/root`

## 6. 完了報告（コードブロックで）

```
Codex-342 完了報告
- 起点の main（git log -1）
- 触ったファイル（新規／変更／廃止）
- 枠の作り（System の部品をどう使ったか・Root だけの上書き）
- 色変数の一覧とコントラスト比（ライト／ダーク）
- アイコンの一覧
- テスト結果
- Claude が確認する手順
- 気になった点（第 2 段に回したもの）
```
