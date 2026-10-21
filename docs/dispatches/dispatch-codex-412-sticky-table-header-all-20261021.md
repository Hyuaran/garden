# Codex-412：全画面の表で「見出しの行を画面の上に固定」＋ブロードバンド収支のつかむ印を 2 段に（2026-10-21）

見た目の正本：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` の §2.5「表の見出しの行」「横に長い表」「行の並べ替え（入れ子）」
見本：`src/app/bud/profit/broadband/BroadbandTable.tsx`（JS で見出しを複製して position:fixed で上に重ねる・横スクロールと同期・画面下の横スクロールのバー）

## 東海林さんの決定（2026-10-21）
1. ブロードバンド収支の「下にスクロールして表の先頭が画面の上に来ると、見出しの行が上に残る。横に動かすと見出しも一緒に動く」を、**他の画面の表でも全部同じに**。今後も同じ
2. 表の中に縦スクロールは作らない（ブラウザの縦スクロールと二重になってマウス操作が面倒）。縦はページのスクロールだけ
3. ブロードバンド収支の並び替えで、**つかむ印を 2 段**に：事業内容の行は「101_回線ショット」の前（つかむとその事業の塊ごと動く）、取引先の行は取引先名の前（同じ事業の中だけで動く）

## 1. 共通部品を作る
- `src/app/system/_components/StickyTable/useStickyTable.tsx`（名前は任せる）：表の外枠（横スクロールする div）の ref を受け取り、
  - 表の thead が画面（＝一番近い縦スクロールする親。外枠 `main` が overflow:auto のことがあるので `closest("main")` か、縦にスクロールする最初の祖先を探す）の上端より上に出たら、thead を複製した見出しを `position:fixed` で上端に出す。列の幅は本物の th の幅をそのまま写す。外枠の左右位置と幅に合わせる。横スクロールと同期（左の固定列があればそれも固定のまま）
  - 表が画面の下にはみ出していて横にスクロールできるあいだ、画面の一番下に表と同じ幅の横スクロールのバーを出す（同期）
  - 表の外枠の横スクロールのバーは隠す（画面下のバーで操作）。表が画面に収まっているときは画面下のバーは出さない＝外枠の下端が見えているとき
  - scroll（capture）・resize・ResizeObserver で位置を合わせる。CSS の `zoom`（Codex-411 の文字の大きさ）がかかっていてもずれないこと（`getBoundingClientRect` の値を zoom で割る必要があるか確かめる）
- ブロードバンド収支の今の実装をこの共通部品に置き換える（見た目・動きは今と同じ）
- 共通の Excel 風の表 `src/app/system/_components/DataTable/DataTable.tsx` と Root の `src/app/root/_components/DataTable.tsx` にこの共通部品を組み込む（＝それを使う画面は全部これで直る）

## 2. 当てる画面（Claude の洗い出し・38 か所）
手で作った表も全部、外枠に ref を付けて共通部品を当てる。**表の中の縦スクロール（max-height＋overflow）はやめる**：
- System：/system/sites（SitesHubClient・SiteNewsPanel）／innovera（InnoveraSyncClient。スマホでカード表示になる幅では不要）／innovera-calls／manuals・manuals/[module]／deliveries／forms／forms/shukkin（linkTable 2 つ）／forms/payroll-notice（送信履歴）／**list（ListMasterClient：検索結果＝max-height:60vh・分析表 3 つ＝max-height:460px をやめて共通部品に。取込プレビュー・ガイド表・内部の表も）**／call-metrics（stickyFirst の左固定は残す）／**kanri（KanriPortalClient の input/result 表 約 12 個。今の CSS の sticky top:0 は外枠に高さが無く効いていない→共通部品に）**／onboarding/admin／docs/hikari-basics
- Bud：/bud/bank（BalanceMatrix。法人の列の左固定は残す）／bud/bank/accounts/[id]（共通 DataTable 経由）／**bud/expenses（ExpenseReviewPanel・ExpenseFinalPanel・ExpenseDonePanel・ExpenseBookingPanel。仕訳待ちの maxHeight:min(70vh,760px) をやめる。グループ見出しの行（top:36 の 2 段目）も複製に含める）**／statements・statements/imports・statements/summary・transfers/csv-export（Tailwind の手書き表）／shiwakechou（JournalTable）
- Root：employees・permissions（役職表 2 つ＋DataTable）・attendance・companies・bank-accounts・vendors・insurance・salary-systems・kot-sync-history（Root の DataTable 経由）／bank-check（2 表）
- **当てないもの**：ダイアログの中の表（LineSendDialog・KotSyncModal）はダイアログの中のスクロールのままでよい。PDF・ツールチップの中の表も対象外
- Bud の外枠 `BudShachoShell.module.css` の `.main.main { overflow-x:auto }` があっても動くこと

## 3. ブロードバンド収支のつかむ印を 2 段に
- 並び替えモードで、事業内容の小計の行は「事業内容」の列の名前の前に印（今どおり・つかむと事業の塊ごと動く）
- 取引先の行は「取引先」の列の取引先名の前に印（今は事業内容の列にある→取引先の列へ）。同じ事業の中だけで動く
- 事業の塊を動かしている間は、塊全体（小計の行＋取引先の行）が浮いて見え、入る場所は事業と事業のあいだにだけ線

## テスト
- 共通部品：先頭が上端を越えたら見出しが出る／戻ったら消える／列の幅の写し／横スクロールの同期／画面下のバーの出る・出ない
- DataTable（System・Root）で見出しが固定される
- list・expenses・kanri で表の中の縦スクロール（max-height）が無くなっている
- ブロードバンド：取引先の行の印が取引先の列にある

## 守ること
- commit・push しない。DB・外部 API に接続しない
- `npx vitest run src/app/system src/app/bud src/app/root src/lib` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す。前から落ちている AppHeader・KpiCard・BackgroundCarousel は触らない）

## 報告（日本語・コードブロック）
変えたファイル（画面ごと）・当てなかったものと理由・テストの結果だけ短く。
