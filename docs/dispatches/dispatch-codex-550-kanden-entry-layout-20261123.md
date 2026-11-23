# Codex-550 関電 事務入力：Garden スタイルの見本（v8）をそのまま社長スタイルへ移す＋一覧タブ（2026-11-23）

## 東海林さんの指示（2026-11-23）
- 「コピペなどもそうだけど、**基本的に Garden スタイルのものを社長スタイルにするだけ**」
  → 見本＝`docs/specs/leaf/kanden-backoffice-v8-poc.html`（春に作った「関電業務委託 事務入力 v8」。リポジトリの旧 `src/app/leaf/_templates/backoffice.html`）。**機能も並びもこの見本のまま**、見た目（色・字・部品）だけ社長スタイルにする。勝手に省かない・別の形に作り替えない（memory：コンセプト HTML は画面まるごと移植が既定）
- タブ：**一覧（新設）**／諸元待ち／エントリー待ち／申込書待ち／郵送待ち／入金待ち／完了／キャンセル／差し戻し（受付待ち・保留はなくす＝下の「決めたこと」）
- **開いたときはエントリー待ちタブ**
- 一覧タブ＝ステータスに関係なく全部の案件の一覧。案件を押したら、一覧タブの中で、エントリー待ちと同じ見た目の詳細へ切り替わる（［一覧へ戻る］）
- 今の入力画面の**左の一覧はなくす**（見本にも無い。見本どおり 前へ／次へ・レコード n / 全件 で送る）
- **左右入れ替え**を付ける（書類のプレビューと入力欄の左右。Bud の経費精算 `src/app/bud/expenses/_components/ExpenseReviewPanel.tsx` の［左右入替］と同じ。押した人ごとに覚える・localStorage は try/catch）

## 見本 v8 から移すもの（全部）
見本を開いて、上から順に同じものを作る。主な関数名は見本の `<script>` にある。
1. **上の操作帯**：［完了処理］［差し戻し］［リスト全項目転記］［→ 次の要確認（Enter）］［検索（Ctrl+F）］・レコード n / 全件・［← 前へ（Ctrl+↑）］［次へ（Ctrl+↓）→］・色の凡例（一致／OCR≠リスト／リスト≠申込書／OCR空欄／新規）
   - 見本の［保留］は差し戻しにまとめるので置かない（下の「決めたこと」）
2. **営業の帯**（renderSalesBanner）：獲得営業担当・社員番号・部署・申込コード・受注日。関連案件の帯（renderRelatedBanner）・止まっている日数（getWaitingDays／isStagnant）
3. **業務ステータスの帯**（renderStatusBar）：各ステップに日付欄。**日付を入れるとステータスが進む**（onStatusDateChange／advanceStatus）。ステップは新しい流れ＝諸元待ち→エントリー待ち→申込書待ち→郵送待ち→入金待ち→完了（Codex-543 の status.ts・列＝specs_on／entered_on／application_received_on／mailed_on／入金は明細から表示のみ）
4. **左：申込書プレビュー**（写メ）：拡大縮小（−／％／＋／100%）、項目を押すと書類の上で光らせる（highlightFieldOnDoc）は写メでは位置が分からないので不要。写メは今の Storage の画像
5. **中：種類の縦タブ**（renderCatTabs）：電灯／動力／ガス／諸元／受領
6. **右：入力**（renderForm／buildSection／buildField）：番号付きのまとまり（❶ 関西電力の電気のお申込み情報（共通）❷ お申込者情報 ❸ 現在の小売電気事業者のご契約 ❹ 請求書・振込用紙 ❺ 同意事項 ❻ 契約種別フラグ ❼ 電灯 ❽ 動力 ❾ ガス …見本どおり）
   - 各欄の右に ✓（照合の色）と 📋（その欄だけリストから写す）。まとまりごとに［📋 セクション転記］（copySectionFromList）、上の［リスト全項目転記］（copyAllFromList）
   - **照合・転記の元（リスト）**＝Garden にある受注の値（FileMaker から取り込んだ leaf_kanden_orders）。OCR は今は無いので、OCR に関わる色は出さない（凡例も OCR の 2 つは出さない）
   - ［→ 次の要確認（Enter）］＝リストと違う欄へ順に移る（jumpToNextDiff）
   - 供給地点 22 桁を入れたら、見本どおり欄の中に供給開始予定（buildSupplyInline・kanden_calendar）
   - 諸元が無いときの注意（buildSpecsAlert）・［諸元を添付］（openAttachSpecsModal → 写メの追加）
7. **下：［✅ エントリーして次へ］**（entryAndNext）・保存ボタン（renderSaveButton）
8. **検索モード**（Ctrl+F・enterSearchMode／executeSearch）：FileMaker のような検索（欄に条件を入れて検索・複数リクエスト・ワイルドカード・演算子 parseSearchOp）。今の右上の検索と同じ結果になるよう、**サーバーで**探す（50 件ずつ）
9. 見本の画面下の「v8 …」の版の表示は不要

## Claude が決めたこと（東海林さんの質問への答え・違えば直す）
- **受付待ちタブはなくす**：営業のフォームの送信は、送った時点で受注にする（諸元の写メがあればエントリー待ち、無ければ諸元待ち）。`leaf_kanden_submissions` から `leaf_kanden_orders` を作る処理を送信の中へ移す（今の受付待ちは本番 0 件）
- **保留は差し戻しにまとめる**：差し戻すときに「営業に知らせる（Chatwork）」チェック（既定オン）。理由は必須。本番の保留は 0 件

## 一覧タブの絵
```
[一覧] 諸元待ち 794  エントリー待ち 80  申込書待ち 35 … 差し戻し 0
検索 [管理番号・お客様名・カナ・住所・電話・理由]
┌管理番号┬受注日┬お客様名┬営業┬ステータス┬実績月┬郵送日┬理由┐  ← 行全体を押す → 一覧タブのまま詳細へ
前へ 1 / 400 次へ
```
- 50 件ずつサーバーで読む（Codex-544 の作り）。ステータス・理由・営業・実績月は見出しで絞り込み

## 守ること
- **git 操作禁止**・**ブラウザ・computer-use 禁止**・**本番 DB への書き込み禁止**（migration は書くだけ）
- 社長スタイル（SystemBreadcrumb／SystemTabs／UpdatedStamp／DataTable・form-kit・線画アイコン＝絵文字は SVG の線画に置き換える）・画面の文字はきちんとした日本語・ちらつかせない
- Vercel の呼び出しを増やさない（案件 1 件の詳細は 1 回・検索はサーバーで 1 回）
- 幅 4 段階（1527／1280／1024／390px）・ライト／ダークで崩れないこと
- 改行は LF

## 確かめ
- `npx vitest run src/app/leaf src/lib/leaf-kanden src/app/system/forms` が緑、`npx tsc --noEmit` でエラーなし

## 報告
`docs/dispatches/report-codex-550-kanden-entry-layout-20261123.md`（見本の機能ごとに「移した／移せなかった（理由）」の表・Vercel の呼び出し回数の見積もり）
