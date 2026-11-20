# Codex-542 関電の事務入力（社長スタイル）（2026-11-20）

## 背景
関電のエントリーまわりを **2026-12-01 から Garden で展開**する（東海林さん）。営業は送信フォーム（Codex-541・`/m/kanden`）で写メつきで送る。事務は今は紙と写メを見て FileMaker（「営業」ファイルの「営業_電気」）に入力しているが、その入力を Garden でできる画面を作る。展開までは現場に出さない（二重入力にはならない）。
- 受注の表＝`leaf_kanden_orders`（Codex-537・FileMaker の写し 18,975 件）。写メ＝`leaf_kanden_photo_sets`／`leaf_kanden_photos`（kanri_no でつながる）。フォームの受付＝`leaf_kanden_submissions`（Codex-541）
- 業務の流れの正本：Obsidian `100_Projects/110_Garden/060_Leaf_個別アプリ/020_Kanden_関電/010_案件ステータスと業務フロー.md`（8 段階・管理日付・スキップ条件・至急SW・諸元待ち・供給地点 22 桁と「日程」）、`030_Backoffice検索仕様.md`、`040_Prodelightリスト運用.md`
- 春の見本（事務入力 v7）：前へ／次へ（Ctrl+↑／↓）、確認済に保存・保留・差し戻し、FileMaker 風の検索、電灯・動力・ガス・諸元・受領の書類表示、「エントリーして次へ」（Enter）

**画面は社長スタイル §2.5〜§2.7 に従う（共通部品：SystemBreadcrumb・SystemTabs・DataTable・Modal・BoxSelect、入力欄は form-kit）。画面ごとに色や部品を作らない。**

## 画面の絵（`/leaf/kanden/entry`・左メニュー「関電 事務入力」）
```
Leaf / 関電
関電 事務入力
 受付待ち 3  諸元待ち 12  エントリー待ち 5  送付待ち 8  請求待ち 4  入金待ち 9  支払待ち 2  完了
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌ 一覧 ─────────────┐┌ 入力 ───────────────────────────┐┌ 書類 ───────────┐
│ 管理番号 お客様名 受注日 ││ 区分 ○奪還 ○囲込    至急SW ○なし ○あり（月）    ││ 電灯 動力 ガス 諸元 受領 │
│ 1527681 山田 太郎 11/19 ││ 管理番号 [   ]  受注日 [    ]                       ││ ［写メを大きく］        │
│ …（行を押すと右に出る）││ お客様名 [   ] カナ [   ] 〒 [   ] 住所 [        ]  ││  拡大・縮小・回転・前後 │
│                         ││ 電話 [   ]                                         ││                         │
│                         ││ 電灯   お客様番号 [   ] 供給地点 [22桁] 日程 01   ││                         │
│                         ││        → 供給開始予定 2026/12/03                    ││                         │
│                         ││ 動力   お客様番号 [   ] 供給地点 [22桁]            ││                         │
│                         ││ ガス   お客様番号 [   ] 供給地点 [   ]             ││                         │
│                         ││ 契約種別 [⌄] 申込プラン [⌄] 動力申込 [⌄]          ││                         │
│                         ││ 獲得手法 [⌄] 受注者 [   ] 事務担当 [   ]           ││                         │
│                         ││ 日付：受注・諸元回収・エントリー・申込送付・請求送付 ││                         │
│                         ││       ・入金・支払・完了・取消                       ││                         │
│                         ││ 備考 [                     ]                        ││                         │
│                         ││ [保留] [差し戻し]           [エントリーして次へ]    ││                         │
└─────────────┘└─────────────────────────────┘└────────────┘
```
- 幅 1384px で 3 列（一覧は狭め・書類は広め）。1024px 以下は「一覧」「入力」「書類」をタブで切り替え（SystemTabs）。スマホは対象外でよいが崩れないこと
- タブ＝ステータス（件数バッジ）。「受付待ち」＝フォームの受付でまだ受注になっていないもの（`leaf_kanden_submissions` で管理番号の受注が無い／Garden で受注を作っていない）
- 一覧は DataTable（検索の薄い字「管理番号・お客様名・カナ・住所・電話・供給地点」）。行を押すと中央に読み込む
- キー操作：Ctrl+↑／↓ で前後の行、Ctrl+Enter で［エントリーして次へ］、Ctrl+S で保存（ボタンの横に小さく書く）

## やること
1. migration `supabase/migrations/20261120000542_leaf_kanden_entry.sql`
   - `leaf_kanden_orders` に列を足す（add column if not exists）：source text not null default 'filemaker'（'filemaker'|'garden'）・status text（8 段階：受注／諸元待ち／エントリー待ち／送付待ち／請求待ち／入金待ち／支払待ち／完了。ほかに 保留・差し戻し・キャンセル）・urgent_sw boolean・sw_month integer・has_denki／has_douryoku／has_gas boolean・payment_received_on・payment_sent_on・completed_on date・submission_id uuid references leaf_kanden_submissions(id)・garden_updated_at timestamptz・garden_updated_by text・hold_reason／return_reason text・is_direct boolean（直営＝支払待ちをスキップ）
   - Garden で作る受注の fm_pk は null を許す（`alter column fm_pk drop not null`）。一意は fm_pk が null でないものだけ（部分一意索引に変える）
   - 変更の履歴 `leaf_kanden_order_history`（order_id・changed_at・changed_by・field・old_value・new_value）を server action で書く
2. ステータスの自動判定 `src/lib/leaf-kanden/status.ts`（純粋な関数・テスト必須）
   - 取消日あり→キャンセル／保留・差し戻しは手で付けたものを優先／完了日→完了／支払日→完了（直営は入金日→完了）／入金日→支払待ち（直営は完了）／請求送付日→入金待ち／申込送付日→請求待ち／エントリー日→送付待ち／諸元あり（諸元回収日 または 諸元の写メ 1 枚以上）→エントリー待ち／それ以外→諸元待ち（受注日があれば）
3. 供給地点特定番号 `src/lib/leaf-kanden/supply-point.ts`（テスト必須）
   - 数字 22 桁でなければ入力欄の下に赤で「22 桁で入力してください（今 n 桁）」
   - 「日程」＝先頭 3 桁の後ろの 2 桁（例 `06 01 551553880322001020` → 01）。`kanden_calendar`（既存の表・216 件。列を確かめて使う）から供給開始予定日を引いて表示
   - 中央 14 桁が同じ受注が他にあれば「同じ供給地点の受注があります（管理番号 …）」と注意
4. 画面 `src/app/leaf/kanden/entry/`
   - 保存は server action（閲覧権限 `leaf-kanden-entry`・既定 manager 以上・歯車で個人も足せる）。保存すると garden_updated_at／by と履歴を書き、status を 2 で再計算
   - ［エントリーして次へ］：エントリー日が空なら今日を入れて保存し、次の行へ
   - ［保留］［差し戻し］：理由を小窓（sm）で入れる。差し戻しはフォームの送り主に Garden通知（`sendGardenNotice`）で「差し戻し：管理番号・理由」
   - 「受付待ち」の行は、フォームの内容（区分・管理番号・お客様名・獲得内容・至急SW・メモ）を入れた状態で新しい受注として開く（source='garden'・submission_id）
   - 書類の欄は Codex-537／541 の写メ表示を使う（種類のタブ＝写メの category。未分類はすべてに出す）。拡大・縮小・90 度回転・前後
   - スマホでの画像保存パスワードは 541 のものをそのまま使う
   - Prodelight のリストとの違いの表示は今回やらない（報告に「次の回」と書く）
5. 左メニューに「関電 事務入力」（/leaf/kanden/entry）を足す。閲覧権限のキー `leaf-kanden-entry`

## 守ること
- **git 操作禁止**・**ブラウザ・computer-use 禁止**・**本番 DB・Storage への書き込み禁止**（migration は書くだけ）
- 社長スタイル §2.5〜2.7 の型・§2.6 の点検。絵文字・明朝・金色なし。画面の文字はきちんとした日本語・開発者用語なし。エラーの知らせは画面の上
- cron を足さない。報告に Vercel 呼び出しの見積もり
- 改行は LF。Codex-541 が作った物は壊さない

## 確かめ
- `npx vitest run src/app/leaf src/lib/leaf-kanden` が緑、`npx tsc --noEmit` でエラーなし

## 報告
`docs/dispatches/report-codex-542-kanden-clerk-entry-20261120.md`
