# Codex-411：Garden 全体に「文字の大きさ（大・中・小）」のボタン（2026-10-21）

## 東海林さんの決定（2026-10-21）
- テクラボにある文字の大きさの個人設定を **Garden にも入れる**
- 置き場所は**右上のボタンの並び**（表示の切り替え・ベル・明暗・ログアウト）。**「あ」のボタン**を足す。押すたびに 中 → 大 → 小 → 中 … と切り替わる
- 人ごとに覚える。社長スタイルの全画面（System・Bud・Root・Rill）に効く

## 決め
- 3 段階：**小＝90％／中＝100％（既定）／大＝115％**
- かけ方：画面全体（`<html>`）に CSS の `zoom` をかける（Garden の画面は px 指定が多く、rem では効かないため。ブラウザの拡大と同じ効き方）。`document.documentElement.style.zoom` と `data-font-size="s|m|l"` を付ける
- 覚え方：localStorage `garden-font-size:{employeeId または userId}`（読み書きは try/catch・読めなければ中）。画面を開いた最初の描画の前に当てる（ちらつかないよう、明暗の切り替えと同じ仕組みの所＝最初に読み込む script／レイアウトで当てる。明暗の保存の仕組みを探して同じ書き方に）
- ボタン：
  - 見た目は明暗・ログアウトと同じ四角の線画ボタン（`iconButton`）。中身は文字「あ」を線画の大きさに合わせて表示し、今の段階を右下に小さく（小／中／大）
  - 説明（actionTip。ほかのボタンと同じ見た目・同じ距離。title は付けない）＝「文字の大きさ：中（押すと大）」のように今と次
  - 並び：表示の切り替え・ベル・**あ**・明暗・ログアウト
- 置く外枠：`src/app/system/_components/ShachoShell/ShachoShell.tsx`（PC とスマホの両方の並び）・`src/app/bud/_components/BudShachoShell/BudShachoShell.tsx`（PC とスマホ）・`src/app/root/_components/RootShell.tsx`・`src/app/rill/_components/`（Rill の外枠）。共通部品 `src/app/system/_components/FontSizeButton.tsx` を作って全部で使う
- 帳票・PDF・印刷（`@media print`）は常に 100％（zoom を外す）

## 気をつけること
- `zoom` をかけると、`getBoundingClientRect` を使って `position:fixed` の位置を出している部品がずれることがある。少なくとも次を 3 段階で確かめて、ずれるなら直す：
  - Bud ブロードバンド収支（`src/app/bud/profit/broadband/BroadbandTable.tsx`）の上に固定する見出しの行・画面の下の横スクロールのバー
  - `BoxSelect`（`src/app/system/_components/BoxSelect/BoxSelect.tsx`）の開いた一覧の位置
  - 外枠の右上ボタンの説明（actionTip）
- スマホ幅（〜760px）でも右上の並びに入ること（今のスマホの並びと同じ大きさ）

## テスト
- 押すたびに 中→大→小→中、`zoom` と `data-font-size` が変わる、localStorage に覚える／読めなくても中で動く
- 4 つの外枠にボタンがあり、説明が出る（title なし）
- 印刷のときは 100％（CSS のテストでよい）

## 守ること
- commit・push しない。DB・外部 API に接続しない
- `npx vitest run src/app/system/_components src/app/bud/_components src/app/root/_components src/app/rill src/app/bud/profit` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す。前から落ちている AppHeader・KpiCard・BackgroundCarousel は触らない）

## 報告（日本語・コードブロック）
変えたファイル・テストの結果・Claude が画面で確かめること だけ短く。
