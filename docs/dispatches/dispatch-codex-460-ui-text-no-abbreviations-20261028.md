# Codex-460：Garden の画面の文字から略称をなくす（2026-10-28）

## 東海林さんの指示
「Garden の画面の文字も略称なしに直して。マニュアルも合わせて」（マニュアルは Claude 側で直す。あなたはコードだけ）。

## 決まり（置き換え表）
画面に出る文字（ボタン・見出し・表の見出し・バッジ・説明文・タブ名・ページの title・エラーや完了の知らせ・Chatwork／Garden通知に送る文・PDF に出る文字）だけを直す。

| 略称 | 置き換え | 例 |
|---|---|---|
| KOT | KING OF TIME | 「KOT取込CSVを生成」→「KING OF TIME 取込CSVを生成」／「KOT用」→「KING OF TIME 用」／「KOTID」→「KING OF TIME の ID」／「勤怠（KOT）」→「勤怠（KING OF TIME）」／title「勤怠 KOT同期状況」→「勤怠 KING OF TIME 同期状況」 |
| MF・MFC | マネーフォワード（クラウド給与などサービス名のときは「マネーフォワード クラウド」） | 「MFで確認」→「マネーフォワードで確認」／「MFクラウド給与ID」→「マネーフォワード クラウド給与 ID」／「MFC 取込」→「マネーフォワード クラウド取込」 |
| OCR | 文字の読み取り（短い所は「読み取り」） | 「OCR要確認」→「読み取り要確認」／「OCR中…」→「読み取り中…」／「請求書OCRに失敗しました」→「請求書の読み取りに失敗しました」／「OCR結果を反映しました」→「読み取り結果を反映しました」 |
| LP | 説明文＝「ランディングページ」／表の見出し・短い札＝「WEB」 | 「WEBインバウンド（LP系）」→「WEBインバウンド（ランディングページ）」／「LP応答・LP発信・LP通話時間・LP申込み」→「WEB応答・WEB発信・WEB通話時間・WEB申込み」／「LP 系回線」→「ランディングページの回線」／「LP 顧客アプリ」→「ランディングページの顧客アプリ」 |
| DB | データベース | 「DB 基盤」→「データベース基盤」 |
| UI | 画面 | 「新UI切替予定」→「新しい画面に切り替え予定」／「入力UI・事務UI」→「入力画面・事務画面」／「上田 UI」→「上田さんの画面」 |
| FM | FileMaker | 「FM取込」→「FileMaker 取込」 |
| PW | パスワード | |
| NDR | 配信不能の通知 | |

- 使ってよい（直さない）：PDF・CSV・LINE・PC・ID・URL・API（③向けでなく画面でも可）、名前そのもの（役職 CS・会社名 TLCC・Chatwork のルーム名・FileMaker の権限名 AP・kintone・INNOVERA・WEB）。
- 直す場所の一覧（Claude が数えた 181 か所）：`C:\Users\shoji\AppData\Local\Temp\claude\C--garden-main028\06d213e8-6dde-48bb-bfee-4f5de01f3c0e\scratchpad\ui_abbrev.txt`。これは「日本語の入った文字列」だけを拾っている。**JSX の中の略称だけの文字（`<th>KOT</th>`・`"MF"` だけのラベル等）も自分で探して直す**。
- 文字が長くなってボタン・表の見出し・札がはみ出す・2 行に割れる所は、幅・折り返しを CSS で直す（1384px と 375px で崩れないこと）。

## 直さないもの（ここを間違えると壊れる）
- コメント・変数名・関数名・型・ファイル名・URL の道（`/kot-export` など）・DB の列名・キー（`kot_daily` など）。
- **外のシステムと突き合わせる文字**：kintone のフィールドコード・選択肢の値、KING OF TIME／マネーフォワード／INNOVERA の API に渡す値・返ってくる値と比べる文字、CSV の列名（取り込むファイル・書き出すファイルの見出し）、Storage のパス。迷ったら直さずに完了報告に書く。
- 使っていない古い控え（`*.legacy-*.ts(x)`・`src/app/page_20260427T172100Z.tsx`・`BloomSidebar.legacy-*`）。
- 画面の名前・メニューの名前が DB に入っているもの：`supabase/migrations/20261026000006_root_view_scopes.sql` の `root-kot-sync-history` の表示名「KOT 同期履歴」→「KING OF TIME 同期履歴」は、**新しい migration `supabase/migrations/20261028000460_view_scope_labels_no_abbrev.sql` を作って update する**（既存の migration は書き換えない。本番への適用は Claude がする）。ほかにも DB に表示名が入っているもの（view scope・manuals・notices の種など）を見つけたら同じ migration に入れる。`src/lib/auth/root-view-scopes.ts` などコード側の同じ名前もそろえる。

## テスト
- 文字を見ているテスト（`getByText("KOT…")` など）は新しい文字に直す。
- `npx tsc --noEmit`・`npx vitest run`（全部。FAIL 0。前から壊れている AppHeader・KpiCard・BackgroundCarousel の 3 本は除いてよい＝報告に書く）。
- 最後に、上の一覧ファイルを作ったのと同じ考え方で数え直し、「日本語の入った画面の文字に残った略称」を完了報告に一覧で出す（残した理由つき）。

## 触らないもの
本番 DB・Storage・環境変数・vercel.json・`docs/` 以外の資料。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
日本語が「???」に化けていないこと。BOM を付けないこと。改行コードを変えないこと。

## 完了報告（コードブロックで）
変更したファイル（数）／新しい migration の中身／残した略称と理由／テスト結果（件数・FAIL 0）。
