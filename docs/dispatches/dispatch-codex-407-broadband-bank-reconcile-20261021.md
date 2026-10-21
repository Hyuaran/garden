# Codex-407：ブロードバンド事業（Kintone アプリ 174）と口座の入出金の突き合わせ＋Garden の写し（2026-10-21）

設計の正本：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\100_Projects\110_Garden\070_Bud_経理収支\050_設計_ブロードバンド事業の収支と口座の突き合わせ_v1_20261021.md`（読むこと）
前の作業：Codex-406（`src/lib/kintone-broadband/kanden-sync.ts`・`/api/system/kintone-broadband/cron`）。Kintone の読み書きの書き方はそれに合わせる。

## 東海林さんの決定（2026-10-21）
- 174 は人が明細を作った時点で**税抜**で入れている。口座は**税込**。**税抜×(1＋税率/100)** と口座の入出金を比べる
- **ぴったり（差が 1 円未満）なら** Garden が 174 に書く：`入金確認`＝入金の行は「入金OK」・支払いの行は「支払OK」／`ドロップダウン_0`（[MF]社名）／`_MF_銀行`／`_MF_摘要`／`_MF_取引日`／`_MF_取引額`
- **金額が違う・予定日を過ぎても届かない → レ点は付けず、Chatwork の Garden 通知で知らせる**。同じ行の知らせは 1 回だけ・直ったら「直りました」を 1 回
- 将来は記録（レコード作成）も Garden で行う → **切り替えられる作り**にする（下の「記録の正」）

## 調べた事実（Claude・読むだけ）
- 174 の欄：`入金確認` DROP_DOWN（支払OK／入金OK）・`ドロップダウン_0` DROP_DOWN（ヒュアラン／ARATA／ストーンベース／たいよう／リンクサポート）・`_MF_銀行` DROP_DOWN（PayPay銀行／みずほ銀行／楽天銀行）・`_MF_摘要` 文字・`_MF_取引日` 日付・`_MF_取引額` 数値・`消費税率` 数値（10 など）・`入出金予定日`・`実績期間`・`事業内容`・`取引先会社名`・`商材名`・`売上_税抜_`・`支払額_税抜_`・`支払額_税込_`・`利益額_税抜_`・`テーブル`（履歴：入力日時・入力者・詳細）
- 入金の行＝`売上_税抜_` > 0、支払いの行＝`支払額_税抜_` > 0
- 今の 2025-10 以降 約 300 行で `入金確認` は 0 件
- 口座の明細：表 `bud_mf_bank_transactions`（全口座・2019〜・30 分ごと更新）。口座 → 法人は `bud_mf_accounts.corp_code`（`src/lib/bud/mf/corporations.ts` に法人名あり）。銀行名は口座の bank_name
- 鍵：.env.local `KINTONE_BROADBAND_APP_ID`／`KINTONE_BROADBAND_TOKEN`（閲覧・追加・編集）

## 1. Garden の写し（記録の正の切り替えの土台）
- 表 `bud_bb_records`：174 の 1 行＝1 行（kintone_record_id・revision・事業内容・取引先会社名・商材名・入金区分・入出金予定日・実績期間・税率・売上税抜・支払額税抜・支払額税込・利益額税抜・入金確認・MF 欄 5 つ・更新日時・raw jsonb）。source 列（'kintone'／'garden'）
- 表 `bud_bb_settings`（1 行）：`record_master`（'kintone' 既定／'garden'）・`recon_from`（照合を始める入出金予定日。既定 2025-04-01）・`notify_from`（知らせを出す予定日の下限。既定 2026-10-01＝過去分で通知が大量に出ないように）・`date_window_before`（既定 10 日）・`date_window_after`（既定 7 日）・`excluded_partners`（text[]・既定 {代理店支払い合計, 関電経費合計}）
- `record_master='kintone'` の間：毎回 174 を全件読んで写しを最新にする（消された行は写しからも消す）。`'garden'` の分岐は**型と入口だけ**用意し、中身は「まだ使えません」を返す（今回は作らない）
- 照合と（後で作る）画面は**写しだけ**を読む。Kintone を直接読まない
- migration は `supabase/migrations/20261021000008_bud_bb_recon.sql`（RLS：読む＝admin 以上・書く＝service role）。Claude が本番に当てる

## 2. 照合（`src/lib/bud/broadband/reconcile.ts`）
- 対象：写しの行のうち、`入出金予定日 >= recon_from`・`取引先会社名` が excluded_partners に無い・`入金確認` が空
- 期待額＝入金の行は round(売上税抜×(1＋税率/100))、支払いの行は round(支払額税抜×(1＋税率/100))。**ぴったり＝|口座の金額 − 税抜×(1＋税率/100)| < 1**
- 候補：入金の行→口座の INCOME、支払いの行→EXPENSE。日付は 予定日−before 〜 予定日＋after。`ドロップダウン_0` が入っていれば、その法人の口座だけ
- 取引先名の決まり：表 `bud_bb_payee_rules`（取引先会社名 → 摘要に含まれる文字。複数可）。決まりがある取引先は摘要が合う明細だけを候補にする。決まりが無い取引先は金額と日付だけで探す
- 1 つの口座の明細は 1 つの行にしか使わない。同じ金額の候補が複数あるときは予定日に近い順、それでも同じなら付けずに「候補が複数」として知らせる
- 結果：
  - **一致** → 174 に書く（下の 3）
  - **金額違い**（決まりで摘要が合う明細が期間内にあるのに金額がぴったりでない）→ 知らせ
  - **未着**（今日が 予定日＋after を過ぎても候補なし）→ 知らせ
  - 予定日前・期間内でまだ無い → 何もしない
- 知らせは `入出金予定日 >= notify_from` の行だけ

## 3. 174 への書き込み
- 一致した行だけ PUT（100 件ずつ）。**`入金確認` が空の行だけ**（人が付けた・Garden が付けた後の行は触らない）。revision を付けて、人が同時に直していたら飛ばす
- 書く値：`入金確認`・`ドロップダウン_0`＝口座の法人を 174 の選択肢名に（ヒュアラン／ARATA／ストーンベース／たいよう／リンクサポート。どれにも当たらなければ空）・`_MF_銀行`＝選択肢にあれば（楽天銀行／みずほ銀行／PayPay銀行）、無ければ空・`_MF_摘要`・`_MF_取引日`・`_MF_取引額`（口座の金額）
- `テーブル`（履歴）に「Garden 口座照合（一致）」の 1 行を足す（入力者は空でよい。406 と同じ書き方）
- 写しも同じ値に更新

## 4. 知らせ（Chatwork）
- 表 `bud_bb_recon_issues`（kintone_record_id・種類 amount_mismatch／not_arrived／ambiguous・内容・opened_at・notified_at・resolved_at・resolved_notified_at）。同じ行・同じ種類は 1 回だけ知らせる。一致した・人がレ点を付けた・行が消えた → resolved として「直りました」を 1 回
- 1 回の実行でまとめて 1 通。文面（非エンジニア向けの日本語・開発者用語なし）：
  ```
  [info][title]ブロードバンド事業：口座と合わない行があります（N 件）[/title]
  ・102_関西電力／株式会社トップウェイ（2026年9月分・予定日 9/30）：予定 60,500 円 → 口座 30,250 円（楽天銀行 9/30）
  ・101_回線ショット／株式会社スカイズ（2026年9月分・予定日 9/30）：予定日を過ぎても入金がありません（予定 1,234,000 円）
  Kintone で金額か予定日を直すと、次の確認で自動で「直りました」と知らせます。
  [/info]
  ```
- 送り先：環境変数 `BUD_BB_RECON_CHATWORK_ROOM_ID`（本番＝Garden 通知 450125458・試し＝開発ルーム 433894375）。送る部品は既存の Chatwork 送信（Garden 通知を送っている所）を使う
- 金額は 3 桁区切り・日付は「9/30」の形

## 5. 実行の入口
- `GET /api/bud/broadband/recon/cron`（CRON_SECRET）：①写しの更新 ②照合 ③書き込み ④知らせ
- `?dryRun=1`：①だけ行い（写しは更新してよい）、②の結果を JSON で返す（一致／金額違い／未着／候補複数／対象外の件数と一覧）。174 にも Chatwork にも書かない
- **vercel.json にはまだ足さない**（Claude が試しモードの結果を東海林さんに見せ、OK 後に毎朝 7:30 で入れる）
- 業務管理ツール（`src/app/system/forms/_data/gyomu-tools.json` の auto）に 1 行：名前「ブロードバンド事業の口座照合」・毎朝・Garden・対象「Kintone ブロードバンド事業-NEW」・minRole admin。406 の行の次に置く（件数を見ているテストも直す）

## テスト
- 期待額の計算（税率 10／8／0・端数）とぴったりの判定
- 候補の絞り方（入出金の向き・日付の幅・法人・摘要の決まり・1 明細 1 行・候補複数）
- 結果の 4 分類と notify_from
- 書き込み：入金確認が空の行だけ・選択肢に無い法人／銀行は空・履歴の 1 行
- 知らせ：1 回だけ・直ったら 1 回・まとめて 1 通の文面
- 試しモードは 174 と Chatwork に書かない
- record_master='garden' は「まだ使えません」

## 守ること
- commit・push しない。DB・Kintone・Chatwork・外部 API に接続しない
- `npx vitest run src/lib/bud/broadband src/lib/kintone-broadband src/app/api/bud/broadband src/app/system/forms` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す）

## 報告（日本語・コードブロック）
変えたファイル・migration の名前・テストの結果・Claude がやること（migration・環境変数・試しモードの呼び方）だけ短く。
