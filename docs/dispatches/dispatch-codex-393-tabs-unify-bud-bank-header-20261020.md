# Codex-393：System のタブの見た目を統一＋Bud 口座残高の見出し・幅・小さな直し（2026-10-20）

## 東海林さんの決定（2026-10-20）
1. **System のタブの見た目を「コーポレートサイト」の形に統一**（今は 契約書管理・リストマスタが角丸の塗りつぶし、業務管理ツール・コーポレートサイトが下線、などバラバラ）。Bud の「口座残高・カード利用」のタブも同じ形に
2. **口座残高の見出しの書き方を System と同じに**（下の絵）
3. **東海林さんのノートパソコンの幅（ブラウザの表示幅 1384px・高さ 713px）で、口座残高の表が横スクロールなしで収まる**ように幅を微調整（今は表が 29px はみ出している：tableWrap 983/1012）
4. 「MFで確認」の欄に、理由（balance_note）を小さく出す（今は設定画面でしか見えない）
5. 増減の色：パソコン側の設定が暗い表示のとき（Garden の切り替えを使っていないとき）も暗い表示用の色になるように（今は Garden の切り替えで暗くしたときだけ）。ほかの社長スタイルの画面と同じやり方に合わせる

## 手本
- タブ：`C:\garden\a-bloom-008\src\app\system\sites\SitesHubClient.tsx` の `topTabs`（css：`C:\garden\a-bloom-008\src\app\system\sites\` の module.css の `.topTabs`）＝文字だけ・下に線・選んでいるタブはティールの太い下線
- 見出し：`C:\garden\a-bloom-008\src\app\system\innovera-calls\InnoveraCallsClient.tsx`（SystemBreadcrumb → h1 → 「INNOVERA最終更新：2026/10/20(火) 19:48」＋丸い矢印の取り直しアイコンボタン `syncIconButton`）
- 社長スタイル：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md`

## 画面の絵（口座残高・カード利用）
```
（右上：東海林 美琴さん  [ベル] [明暗] [ログアウト] ＝今の Bud の外枠のボタンのまま）
Bud / 口座残高・カード利用                ← 小さい場所の表示（System の SystemBreadcrumb と同じ見た目。「Bud」は /bud/dashboard へのリンク）
口座残高・カード利用                       ← 大きい見出し（System の h1 と同じ）
マネーフォワードの口座残高とクレジットカードの利用を見られます。   ← 説明 1 行（System の lead と同じ）
最終読み込み：2026/10/20(火) 19:30  (↻)   ← INNOVERA と同じ形。↻ ＝今の「読み直す」と同じ動き（1 分に 1 回まで・読み込み中は回る）

 口座残高   カード利用                      [並び替え] [設定]   ← タブ＝コーポレートサイトの形。並び替え・設定は全権だけ（今のまま）
━━━━━━━━──────────────────────────────────
┌ グループ合計 ┐ … 表 …
```
- Bud の外枠の上の帯にある「Bud ／ 口座残高・カード利用」の文字は、この画面では出さない（場所の表示が画面の中に移るため二重になる）。**Bud のほかの画面の上の帯はそのまま**
- 「MFで確認」の欄：「MFで確認」の下に小さく理由（例「帳簿と銀行の残高がずれています（今年度より前から）」）。長いときは折り返す。この欄があっても表が横にはみ出さないこと

## タブの統一の範囲
- 共通の部品を 1 つ作る（例：`C:\garden\a-bloom-008\src\app\system\_components\SystemTabs\`）。見た目は sites の `.topTabs` と同じ。件数のバッジ（業務管理ツールのタブの「3」「12」など）を付けられるように
- 置き換える（パネルを切り替えるタブだけ。リスト／グリッドの表示切り替え・絞り込みのボタンは対象外）：
  - `src\app\system\sites\SitesHubClient.tsx`（手本。部品に置き換えるだけ・見た目は変えない）
  - `src\app\system\contracts\page.tsx`（契約書を見る／登録する）
  - `src\app\system\list\_components\ListMasterClient.tsx`（リスト／アップロード／分析／履歴検索／自社アポ禁／管理方法）
  - `src\app\system\forms\FormsHubClient.tsx`（件数バッジ付き。リスト／グリッドの切り替えは必ず今のまま使えること）
  - `src\app\system\forms\shukkin\ShukkinClient.tsx`
  - `src\app\system\call-metrics\CallMetricsClient.tsx`
  - `src\app\_components\notices\NoticeList.tsx`（お知らせ／公開の管理）
  - `src\app\system\manuals\` のマニュアルの中の切り替え（操作マニュアル／要点／仕組み／仕様／Claude 用）
  - `src\app\system\kanri\KanriPortalClient.tsx`・`src\app\system\deliveries\DeliveriesHubClient.tsx` ほか `src\app\system\` の中で、パネルを切り替えるタブがあれば同じく
  - `src\app\bud\bank\BankAccounts.tsx`
- タブの数が多くて狭い幅に入らないときは、タブの列だけ横にスクロール（ページ全体ははみ出さない）
- 明暗どちらでも見えること（選んでいるタブ＝見出しの色＋ティールの下線、選んでいないタブ＝薄い文字）
- キーボード操作・role="tab"／aria-selected は今のまま保つ

## 幅の微調整（口座残高の表）
- 表示幅 1384px（Bud の外枠のメニューを開いた状態）で、表に横スクロールが出ないこと。列の内側の余白・最小幅を詰める。金額の文字の大きさは読みやすさを落とさない範囲で
- 行の高さも少し詰めてよい（縦にも多く見えるように）。スマホ（375px）は今のまま表だけ横スクロール・法人の列を左に固定

## テスト
- 共通のタブ部品（選んだタブ・件数バッジ・クリックで切り替わる）
- 置き換えた画面のテストが通ること。`src\app\system\forms\page.test.tsx` の「renders forms visible to staff」は前の変更（タブ化）から落ちているので、今のタブの作りに合わせて直す
- Bud 口座残高：場所の表示と見出し・最終読み込みの形（2026/10/20(火) 19:30）・↻ で読み直す・「MFで確認」の理由が出る

## 守ること
- commit・push しない。DB・本物の MF に接続しない
- 各画面の動き（切り替えた中身・保存・URL の ?tab= など）は変えない。見た目だけ
- `npx vitest run src/app/system src/app/bud src/app/_components src/lib/bud` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す。前から落ちている AppHeader・KpiCard・BackgroundCarousel は触らない）

## 報告（日本語・コードブロック）
変えたファイル・置き換えたタブの一覧（置き換えなかったものと理由）・テストの結果だけ短く。
