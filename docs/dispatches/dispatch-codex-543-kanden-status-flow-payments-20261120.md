# Codex-543 関電：ステータスを業務の流れに作り直す・実績月・プロディライトの入金明細の取り込み（2026-11-20）

## 背景（東海林さん 2026-11-20）
Codex-542 の事務入力（`/leaf/kanden/entry`）は 8 段階（受注→諸元待ち→エントリー待ち→送付待ち→請求待ち→入金待ち→支払待ち→完了）で作ったが、実際の業務の流れは次のとおり。これに作り直す。

```
諸元待ち → エントリー待ち → 申込書待ち → 郵送待ち → 入金待ち → 完了
                                                       ↘ キャンセル（戻入あり／取消）
```
| ステータス | 意味 | 次へ進む合図 |
|---|---|---|
| 諸元待ち | 諸元がまだ無い（TimeTree の緑のラベル） | 諸元の写メが届く・諸元回収日を入れる。最初から諸元があれば飛ばしてエントリー待ちから |
| エントリー待ち | 事務のチェック待ち | エントリー日（チェックが済んだ日）を入れる |
| 申込書待ち | 営業が事務所に申込書を持ってくるのを待つ | 申込書受取日を入れる |
| 郵送待ち | 上位店（プロディライト）へ郵送するのを待つ | 郵送日を入れる |
| 入金待ち | 郵送して、基本は翌月に入金がある | 入金明細に入金（プラス）があれば完了 |
| 完了 | 入金あり | — |
| キャンセル | 入金明細に戻入（マイナス）がある／取消日あり | — |
- ほかに今の「保留」「差し戻し」は残す（手で付ける）
- **実績月**（YYYY-MM）の欄を足す。最初は受注日の月。月ズレの案件だけ事務が直す
- **入金明細**：プロディライトから毎月届く Excel。全部見て、戻入があればキャンセル、入金があれば完了

## やること
1. migration `supabase/migrations/20261120000543_leaf_kanden_status_flow.sql`
   - `leaf_kanden_orders` に列を足す：jisseki_month text（'YYYY-MM'）・application_received_on date（申込書受取日）・mailed_on date（郵送日）・paid_on date（入金日＝入金明細の月から）・refunded_on date（戻入の月）・timetree_label text（TimeTree のラベル名）
   - status の check を新しい値（諸元待ち／エントリー待ち／申込書待ち／郵送待ち／入金待ち／完了／キャンセル／保留／差し戻し）に入れ替える。古い値の行は null に戻して読み取り時に判定する
   - `leaf_kanden_payments`（入金明細の 1 行）：id uuid pk／pd_row_no text not null unique（Excel の「No.」例 26064-0429）／statement_month text（'YYYY-MM'＝ファイル名の「2026.11月」）／sales_name・sales_method・customer_name・customer_kana・list_flag・acquisition（囲込/奪還）・item（契約品目）・note text／sent_on date（データー送信日 申込書発送日）／customer_no text（門標）／kanri_no text（normalizeKanriNo）・kanri_no_raw text／amount integer（コミッション請求額・マイナス＝戻入）／order_id uuid references leaf_kanden_orders(id)（つないだ受注）／match_note text／source_file text／imported_at timestamptz default now()
   - `leaf_kanden_entry_list`・`leaf_kanden_case_list` などの読み取り時のステータス判定を新しい流れに直す（下の 2）
2. ステータスの判定 `src/lib/leaf-kanden/status.ts` を作り直す（純粋な関数・テスト必須。SQL 側の判定と同じ結果にする）
   - 強い順：手で付けた保留／差し戻し → 取消日 or 戻入あり（refunded_on）→ キャンセル → 入金あり（paid_on）→ 完了 → 郵送日 → 入金待ち → 申込書受取日 → 郵送待ち → エントリー日 → 申込書待ち → 諸元あり（諸元回収日 or 諸元の写メ or TimeTree のラベルが諸元待ちでない）→ エントリー待ち → それ以外 → 諸元待ち
   - 実績月が空なら受注日の月
3. 入金明細の取り込みスクリプト `scripts/leaf-kanden-payments/import-statements.ts`
   - 引数 `--dir <フォルダ>`（中を全部さがす）・`--file <ファイル>`（1 つだけ）・`--dry-run`
   - 対象＝ファイル名に「プロディライト」と「支払詳細」を含む `.xlsx`。**ファイル名に「暫定」「削除候補」を含むものは読まない**（確定版が別にある）。同じ月に複数あるときは全部読み、「No.」で重ならないようにする（「スポット案件」の版も読む）
   - シート「業務委託（囲い込み＿奪還）」の 2 行目から。見出しは 1 行目（No.／獲得担当 フルネーム／営業手法／データー送信日 申込書発送日／門標※／管理番号／リスト／契約名義／契約名義（ｶﾅ）／囲込 奪還／契約品目／コミッション 請求額／備考）。No. が空の行・合計の行は飛ばす
   - statement_month はファイル名の「YYYY.M月」から
   - 受注とつなぐ：管理番号（normalizeKanriNo）が同じ受注のうち、契約品目の電灯／動力／ガスと受注の契約種別・動力申込が合うもの。1 件に決まらなければ order_id は空で match_note に理由（「同じ管理番号の受注が 3 件」など）
   - つないだ受注に、プラスなら paid_on（その月の 1 日）、マイナスなら refunded_on を入れる（もっと新しい明細が来たら上書き）
   - 結果：読んだファイル数・行数・つないだ数・つなげなかった数（理由別）を出す
   - Excel が無く PDF だけの月（2024-01・2024-06・2024-08〜12）は今回は読まない。報告に月の一覧を書く
4. 昔の受注のステータスの付け直しスクリプト `scripts/leaf-kanden-orders/apply-timetree-labels.ts`
   - 入力：TimeTree の一覧 JSON（Claude が渡す・`[{"no":"1527681","label":"諸元待ち"}...]` の形）。kanri_no が同じ受注の timetree_label に入れる
   - **昔の受注（FileMaker から取り込んだ分）の決まり（東海林さん 2026-11-20）**：FileMaker でエントリー OK でも、入金明細に入金が無いものは「郵送前にキャンセルになった案件」。
     - orders に `cancel_reason text` を足す（例「郵送前キャンセル（入金なし）」「戻入あり」「取消日あり」）
     - 同じスクリプトに `--apply-legacy-cancel` を付けたら：FileMaker 由来の受注のうち、入金（paid_on）も戻入も無く、受注日が「取り込んだ入金明細の最新月の 2 か月前の月末」以前のもの → status＝キャンセル・cancel_reason＝郵送前キャンセル（入金なし）。それより新しいものは触らない（まだ入金待ちの可能性）
     - ただし、入金が来るはずの月（受注月の翌月〜翌々月）が Excel の無い月（2024-01・2024-06・2024-08〜12）に当たるものはキャンセルにせず、`match_note` 相当の印（cancel_reason＝「要確認（明細が PDF の月）」・status は空のまま）を付けて件数を出す
     - `--dry-run` で件数（キャンセルにする数・要確認の数・触らない数）を先に出せること
5. 事務入力 `/leaf/kanden/entry` と 案件一覧 `/leaf/kanden` を新しい流れにそろえる
   - 事務入力のタブ＝諸元待ち／エントリー待ち／申込書待ち／郵送待ち／入金待ち／完了／キャンセル／保留／差し戻し（件数バッジ）。受付待ちのタブはそのまま先頭に
   - 入力欄に「実績月」「申込書受取日」「郵送日」を足す。入金日・戻入は入金明細から入る（入力欄にはせず表示だけ。どの明細の何円かを出す）
   - 受注の詳細（案件一覧の小窓）にも、入金明細の行（月・金額・入金／戻入）を出す
   - 案件一覧のタブ（進行中／完了／キャンセル）は、新しい判定で数える
6. テスト：status.ts、入金明細の 1 行の読み取り（`import-statements.core.ts` に分ける）、受注とのつなぎ方、画面のタブ

## 守ること
- **git 操作禁止**・**ブラウザ・computer-use 禁止**・**本番 DB・Storage への書き込み禁止**（migration とスクリプトは書くだけ。動かすのは Claude）
- 入金明細は G ドライブの社内の経理ファイル。中身（お客様名など）をログ・報告に書かない
- 社長スタイル §2.5〜2.7、画面の文字はきちんとした日本語、Vercel の呼び出しを増やさない
- 改行は LF

- vitest.config.ts の include に `scripts/leaf-kanden-payments/*.test.ts` を足す

## 確かめ
- `npx vitest run src/app/leaf src/lib/leaf-kanden scripts/leaf-kanden-payments scripts/leaf-kanden-orders` が緑、`npx tsc --noEmit` でエラーなし

## 報告
`docs/dispatches/report-codex-543-kanden-status-flow-payments-20261120.md`
