# Codex-413：並び替えを全部「≡ をつかんで動かす」に統一＋固定見出しの 2 段目を今のまとまりに＋口座残高に「MF で再取得」（2026-10-21）

見本：`src/app/bud/profit/broadband/BroadbandTable.tsx` の並び替え（⇅ で並び替えモード → 行の左に ≡ の線画 → マウスはドラッグ、スマホ・タブレットは長押し約 0.4 秒で動かす → 入る場所に線 → キーボードは ≡ にフォーカスして ↑↓）
見た目の正本：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5「行の並べ替え（入れ子）」

## 東海林さんの決定（2026-10-21）
1. **口座残高・カード利用の並び替えを、ブロードバンド収支と同じ ≡ の形にする**（クリック長押しで移動）
2. **今後の並び替えは全部この形**。ほかにも並び替えがあれば、この形に変える
3. （Claude の確認で見つけた）上に固定した見出しの 2 段目（経費精算の仕訳待ちの「申請者ごとのまとまりの行」）が、最初の人のまま変わらない → 今見えているまとまりの行に変わるように
4. 口座残高の ↻（MF最終更新）の隣に「MF で再取得」のリンク（MF の API には再取得の窓口が無いため、MF の画面を開く）

## 1. 共通部品を作る
- `src/app/system/_components/ReorderGrip/`（名前は任せる）：ブロードバンド収支の実装（pointer の長押し・ドラッグ・入る場所の線・キーボード ↑↓・つかんでいる間の浮いた見た目）を共通にする。縦（行）と横（列）の両方に使える（`axis: "y" | "x"`）
- ≡ の線画（縦の並び）／横に並ぶものは同じ ≡ を 90 度回した線画
- ブロードバンド収支はこの共通部品に置き換える（動きは今と同じ）

## 2. 当てる所
- **Bud 口座残高・カード利用**（`src/app/bud/bank/BankAccounts.tsx`・`BalanceMatrix.tsx`）
  - 口座残高の表：今の「←／→」「↑／↓」のボタン（`move(axis,key,…)`）をやめ、⇅ の並び替えモードで、**法人の行は法人名の前の ≡ で上下**、**銀行の列は銀行名の見出しの ≡ で左右**に動かす。保存は今の API（axis-order の PATCH）のまま
  - カード利用：今のネイティブの draggable（`onDragStart`）をやめ、カードの名前の前の ≡ を長押し・ドラッグで動かす。保存は今の reorder のまま
  - 並び替えは全員共通の順（今どおり・全権だけ）
- **ほかの社長スタイルの画面で並び替えがある所**を探して、同じ形にする（System・Bud・Root・Rill。候補：`src/app/bud/expenses/page.tsx`・`src/app/rill/mail/_components/RillMailScreen.tsx`・`src/app/system/_components/DataTable/DataTable.tsx`（ここは列の並べ替え＝ソートなら対象外）。「並べ替え＝表の昇順・降順のソート」は対象外で、「並び順を人が決めて保存する」ものだけが対象。旧モック（BudFaithfulFrame）・bloom・tree は対象外）。見つけた所と変えたか・変えなかった理由を報告に書く

## 3. 固定見出しの 2 段目
- `src/app/system/_components/StickyTable/useStickyTable.tsx`：まとまりの行（`tr[data-...]` のグループ見出し）を複製するときは、**今、画面の上端の位置にある行が属しているまとまりの行**を写す（スクロールのたびに差し替える）。まとまりが無い表は今どおり

## 4. 口座残高に「MF で再取得」
- `UpdatedStamp` の行（MF最終更新：… ↻）の ↻ の左に、文字のリンク「MF で再取得」（線画の外部リンクのアイコン付き・小さめ・`--sub` の色・下線なし、ホバーでティール）
- リンク先：`https://accounting.moneyforward.com/accounts`（MF の「データ連携 › 登録済一覧」。ここに［一括更新］がある）・別タブ（`target="_blank" rel="noopener noreferrer"`）
- 説明（actionTip と同じ見た目・title は付けない）：「MF の画面を開きます。［一括更新］で銀行から取り直したあと、↻ で Garden に読み込みます」
- ↻ の説明も「MF に届いている分を読み直す（銀行からの取り直しは MF の［一括更新］）」に

## テスト
- 共通部品：長押し前に動かしてもドラッグにならない（スマホのスクロールと区別）／ドラッグで順が変わる／キーボード ↑↓／横（列）でも動く
- 口座残高：法人の行・銀行の列・カードが ≡ で動き、今の API で保存される。←→↑↓ のボタンが無い
- 固定見出しの 2 段目が今のまとまりに変わる
- 「MF で再取得」のリンク先・別タブ・説明

## 守ること
- commit・push しない。DB・MF・外部 API に接続しない
- `npx vitest run src/app/system src/app/bud src/app/root src/app/rill src/lib` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す。前から落ちている AppHeader・KpiCard・BackgroundCarousel は触らない）

## 報告（日本語・コードブロック）
変えたファイル・並び替えを見つけた所（変えた／変えない・理由）・テストの結果だけ短く。
