# Codex-344 Rill を社長スタイルに：System と同じ枠（左端のモジュールアイコン＋左メニュー）＋上の帯の機能は残して社長スタイルの色と線画アイコンに

作成日: 2026-09-18
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認・完了報告に書く）。**同じ作業ツリーで Codex-342／343（Root の社長スタイル化・`src/app/root/` だけ）が動いていることがある。`src/app/root/` は読みも編集もしない。tsc やテストが Root 側の途中の変更で落ちたときは、Rill の範囲のテストが緑なら完了報告にその旨を書けばよい。**
**git は触らないこと（commit するな）。本番のデータ・DB・Microsoft のメールに触らないこと。開発サーバ・ブラウザを起動しないこと。migration は不要。触ってよいのは `src/app/rill/` 配下とそのテストだけ。例外として `src/app/_components/layout/GardenShell/GardenShell.tsx` の中の関数（日付・天気・お気に入りの読み書き）に `export` を足すことだけは可（中身と Garden 全体の見た目・動きは変えない）。`src/app/system/` と `src/app/_components/` のそれ以外は読むだけ（import は可）。**

必ず先に読むもの：
- 見た目の正本：C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md（§2 変数・§3 守ること＝`::before` の 1 行・ダークの見出し色・font-family を落とさない・**Garden 共通の変数を書き換えない**）
- 見本（System の枠）：`src/app/system/layout.tsx`（ログイン中の本人の取り方）・`src/app/system/_components/ShachoShell/ShachoShell.tsx`・`shacho-shell.module.css`（rail・side・nav・who・actions・iconButton）
- 今の Rill：`src/app/rill/layout.tsx`・`src/app/rill/mail/_components/RillMailScreen.tsx`（`GardenShell` に `activeModule="rill"`・`pageMenu`・`contentFullBleed` で載っている。モーダルは body 直下へポータル）・`RillMailScreen.module.css`・`RillComposePane.tsx`
- 今の上の帯：`src/app/_components/layout/GardenShell/GardenShell.tsx` の `<header className="gs-header …">`（844〜978 行あたり）と右の Activity Panel（1024〜1086 行あたり）

## 0. 何をするか（東海林さん 2026-09-18）

「Root 同様 Rill も社長スタイルに」「上の帯の機能は無くさず、色を合わせて」「未展開なので本番に出して OK」。

- 枠を **System と同じ形**（左端のモジュールアイコン列＋左メニュー＋右上の操作）にする
- 今の上の帯の機能は **全部残す**（下の §2 の表）。見た目は社長スタイル・**アイコンは線画の SVG**（PNG の絵・絵文字・記号文字は使わない）
- メール画面の中身（3 列・ツールバー・一覧・本文・下書き・取り込み・通知 PDF など）の **機能と文言は変えない**。色とフォントだけ社長スタイルに
- メール本文（送信者の HTML）の見た目はそのまま

## 1. 画面

```
┌──┬──────────────┬──────────────────────────────────────────────────────────────┐
│S │ [樹] Garden    │ [検索（取引先、請求書…） Ctrl+Shift+G] 9/18(金) ☁ 22℃ ●正常 [☾][🔔][?][☆][(東)東海林 ▾]│ ← 上の帯（社長スタイル・線画）
│─ │ Rill ／ メッセージ│──────────────────────────────────────────────────────────────│
│B │                │ [更新][異常チェック] 最終更新 22:50・60秒ごと [新規][返信]…     [検索…] │ ← メールのツールバー（今のまま・色だけ）
│F │ メニュー        │ ┌────────┬─────────────────┬──────────────────────────┐ │
│… │ ■ Mail         │ │ 受信箱   │ 件名一覧            │ 本文                        │ │
│R◀│ ▢ Chat（year-end）│ │ …       │ …                 │ …                         │ │
│… │                │ └────────┴─────────────────┴──────────────────────────┘ │
│  │ (東) 東海林 美琴 │                                                              │
│  │     全権管理者   │                                                              │
└──┴──────────────┴──────────────────────────────────────────────────────────────┘
 左端＝System と同じモジュールアイコン列（Rill が選択中）
```

- **左端（rail）**：System の `ShachoShell` と同じ部品・並び（いちばん上に System → 区切り → `getVisibleModules(role)` のモジュール）。**Rill が `current`**
- **左メニュー（side）**：「[樹のマーク] Garden」（`/` へ）＋「Rill ／ メッセージ」。メニューは今の 2 つ（「Mail」＝`/rill/mail`・選択中／「Chat（year-end）」＝`#rill-chat`）をそのまま、アイコンは線画（封筒・吹き出し）。下に利用者（頭文字の丸・氏名・会社／役職）
- **本文**：幅の上限なし・余白なし（今の `contentFullBleed` と同じ）。メール画面は **上の帯の下から画面の下まで**の高さ（`height: calc(100vh - 帯の高さ)`）で、ページ全体はスクロールしない（今と同じ）
- **ログイン中の本人**：`rill/layout.tsx` を System の `layout.tsx` と同じやり方（サーバで `root_employees`＋会社名）で本人を取り、枠に渡す。**今の帯は利用者名が「東海林 美琴」固定・ログアウトが効かない作りだったので、ここで本物にする**（ログアウト＝System と同じ `auth.signOut()` → `/login`）。`ModuleGate`（Rill は admin 以上）はそのまま残す
- スマホ幅は System と同じ縮み方

## 2. 上の帯（全部残す・社長スタイルに）

| 今の機能 | 新しい見た目 | 動き |
|---|---|---|
| 検索ボックス「検索 (取引先、請求書、タスク、ヘルプなど)」＋「Ctrl+Shift+G」 | 角丸の入力欄（カード地・`--line` 枠・線画の虫めがね）＋右端に小さく Ctrl+Shift+G | **今と同じ**（Ctrl+Shift+G で入力欄にフォーカス。入力しても何も起きないのも今と同じ） |
| 日付（`formatDateJP`・1 分ごと更新） | 線画のカレンダー＋文字 | 同じ |
| 天気（現在地 → open-meteo・`weatherLabel`） | **線画の天気アイコン**（晴れ・くもり・雨・雪・雷・霧を SVG で。PNG は使わない）＋気温＋ラベル | 同じ（取得失敗時の「位置未設定」「天気取得待ち」も同じ） |
| 「すべてのシステム正常」＋緑の点 | 小さなティールの点＋文字 | 同じ |
| ライト／ダーク切替 | System と同じ `iconButton`（太陽／月の線画） | `useTheme().toggleTheme` |
| 通知（ベル＋未読数バッジ）→ 右の Activity Panel を開く | 線画のベル＋未読数の丸 | 右から出るパネル（社長スタイルのカード地・題「Today's Activity」・「すべて既読／すべて未読」・通知設定リンクは線画の歯車）。Rill は通知 0 件なので「新しいお知らせはありません」を表示（**文言を足すのはここだけ**） |
| ヘルプ（押しても何も起きない） | 線画の「?」 | 同じ（何も起きない） |
| お気に入り（一覧・現在のページを追加・削除） | 線画の星＋ドロップダウン（カード地・角丸 12・影） | **同じ保存先**（Garden 全体と共有。GardenShell の `readFavorites`／`writeFavorites`／`subscribeFavorites` を export して使う）。追加するときの題は「Rill Mail」、アイコンは付けない（線画の封筒を画面側で出す） |
| 利用者（アバター画像＋名前＋役職 ▾）→ マイページ／ユーザー設定／ショートカット一覧／ログアウト | 頭文字の丸＋名前＋役職＋線画の山形 → 同じ 4 項目（各項目に線画アイコン。「⌨」は使わない） | 同じリンク先。ショートカット一覧は `ShortcutsModal` をそのまま開く。ログアウトは §1 の本物のログアウト |
| 左メニューの開閉（‹ ›） | 付けない（System と同じ固定幅） | ― |

- 帯の地は `--card`、下に `--line` の罫線、高さ 60px 前後。ダークでも読めること

## 3. 色（Rill の中だけ差し替える）

メール画面の CSS は Garden 共通の変数（`--bg-paper-soft`・`--text-main`・`--accent-green` など 19 個）を使っている。**共通の定義は書き換えず**、Rill の枠のいちばん外のクラスで **同じ名前の変数を上書き**して社長スタイルの値にする（CSS 変数は内側に継承されるので、Rill の中だけ変わる）。

| 変数 | ライト | ダーク |
|---|---|---|
| --bg-paper-soft | `#f4f5f7` | `#0c1726` |
| --bg-card／--bg-card-solid | `#ffffff` | `#152438` |
| --bg-card-hover | `#eef3f8` | `#1c2e46` |
| --border-soft | `#e3eaf3` | `#31435a` |
| --border-card | `#d7dfea` | `#3a4f6b` |
| --text-main | `#17212e` | `#edf4fb` |
| --text-sub | `#5a6b80` | `#b7c5d4` |
| --text-muted | `#5f6f82` | `#9fb0c3` |
| --text-accent | `#0b7e7a` | `#5fd6c9` |
| --text-info | `#1d6fb8` | `#8cc4f5` |
| --text-warning | `#b45309` | `#fbbf6b` |
| --accent-green | `#0ea5a0` | `#0ea5a0` |
| --accent-green-d | `#0b7e7a` | `#0ea5a0` |
| --accent-blue | `#2563eb` | `#7aa7ff` |
| --accent-gold | `#d97706` | `#f5b454` |
| --accent-gold-d | `#b45309` | `#fbbf6b` |
| --accent-pink | `#db2777` | `#f472b6` |
| --shadow-soft | `0 4px 14px rgba(16,35,63,.07)` | `0 4px 14px rgba(0,0,0,.22)` |

- 上の値は出発点。実際の使われ方（例：`--accent-green-d` を**地**にして `--bg-card-solid` を**文字**にしている下書きドック）を見て、読めない組み合わせがあれば値か CSS を直す。**本文・補助 4.5:1 以上・大きな見出し 3:1 以上**（ライト／ダーク）。完了報告に主要な組み合わせの比を書く
- 枠のクラスに社長スタイルの `font-family`（ゴシック）と `::before{content:"";position:fixed;inset:0;z-index:-1;background:var(--bg)}` を必ず入れる
- **body 直下へポータルしているモーダル**（通知 PDF の作業画面など）は枠の外に出るので、ポータルの中身の外側にも **同じ変数のクラス**を付ける（付けないとクリーム色・明朝に戻る）
- 画面に出ている記号：接続画面の「✉」→ 線画の封筒、ツールバーの「↻ 更新」→ 線画の回転矢印＋「更新」、その他 Rill の画面に出る絵文字・記号アイコンがあれば線画に

## 4. 触らないもの
- メールの読み書き・取り込み・翻訳・下書き・送信取り消し・ピン・異常チェックの動き、API（`src/app/api/rill/`）、`mail/_lib/`
- `src/app/root/`（別の Codex が作業中）
- Garden 共通の CSS 変数の定義（`globals.css` 等）・`GardenShell` の見た目と動き（export を足すだけ）

## 5. テスト（vitest・全部緑にしてから完了報告）
- 新しい枠：rail が出て Rill が `current`／左メニュー 2 項目（Mail が `aria-current="page"`）／上の帯に 検索・日付・天気・状態・テーマ切替・通知・ヘルプ・お気に入り・利用者メニュー（4 項目）がある／ログアウトで `signOut` が呼ばれる／利用者名がログイン中の本人（固定の名前ではない）
- Ctrl+Shift+G で検索欄にフォーカス
- お気に入りの追加・削除が Garden 共通の保存先に効く
- 通知 0 件で「新しいお知らせはありません」
- Rill 配下の画面に出る文字列に絵文字の範囲の文字・「✉」「↻」「⌨」が無い
- 既存の Rill のテストが全部通る
- `npx tsc --noEmit`・`npx vitest run src/app/rill src/app/_components/layout/GardenShell`

## 6. 完了報告（コードブロックで）

```
Codex-344 完了報告
- 起点の main（git log -1）
- 触ったファイル（新規／変更）
- 枠の作り（System の部品の使い方・本人の取り方・ログアウト）
- 上の帯の機能ごとの対応
- 色変数の上書き一覧とコントラスト比（ライト／ダーク）
- テスト結果
- Claude が確認する手順
- 気になった点
```
