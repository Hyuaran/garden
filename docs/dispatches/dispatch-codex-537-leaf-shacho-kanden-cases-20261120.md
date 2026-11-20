# Codex-537 Leaf を社長スタイルに・関電の案件一覧（FileMaker の受注＋写メ）（2026-11-20）

## 背景
関電のエントリーまわりを Garden で実走させる（東海林さん 2026-11-20 最優先）。今の `/leaf/kanden/input`・`/leaf/kanden/backoffice` は春に作った見本の HTML を枠に映しているだけ（Gardenスタイル・保存先なし）。
今回は **Leaf を社長スタイルにして**、事務が使う **関電の案件一覧** を本物のデータで作る。
- 案件＝FileMaker「営業」ファイルの表「営業_電気」の受注（18,964 件・2022〜）。Claude がホスト PC で読み出して CSV にし、このあと作る取り込みスクリプトで Garden に入れる
- 写メ＝Codex-535 で作った `leaf_kanden_photos`（管理番号 `kanri_no` でつながる）。今夜から全 8 万枚を取り込み中
- 設計の正本：Obsidian `100_Projects/110_Garden/060_Leaf_個別アプリ/020_Kanden_関電/050_写メの保管とTimeTree移行.md`

**画面は社長スタイル §2.5 の型・§2.6 の点検・§2.7（フォームは今回なし）に従う**（Obsidian `070_AI-Rules/050_Gardenスタイル・社長スタイル.md`）。手本＝Soil を社長スタイルにした Codex-521（`docs/dispatches/dispatch-codex-521-soil-module-screens-20261112.md`・`src/app/soil/`）。

## 画面の絵
```
（外枠：左メニュー＝Leaf ／ 右上＝○○さん [一覧/カード(グレー)] [ベル] [明暗] [ログアウト]）
Leaf / 関電                                                  ← SystemBreadcrumb
関電 案件一覧                                                ← h1 30px（左メニューの名前と同じ）
                        FileMaker 取り込み最終更新：2026/11/20(金) 21:30 (↻グレー)
 進行中 1,234   完了 17,500   キャンセル 72                  ← SystemTabs（件数バッジ）
━━━━━━━──────────────────────────────────────
 [受注した年度 ⌄ 2026年度]                                   ← BoxSelect（サーバーで絞る・既定は今年度）
 件数 1,234 件 ／ 写メあり 1,100 件
┌管理番号┬受注日┬お客様名┬区分┬契約種別┬進捗┬エントリー日┬申込送付日┬請求送付日┬受注者┬事務担当┬写メ┐
│1527681 │2026-11-19│山田 太郎│奪還│従量電灯B│エントリー完了│2026-11-20│…│…│萩尾│東海林│ 4 │
└────┴───┴────┴──┴────┴──────┴─────┴────┴────┴──┴───┴──┘
   行全体を押す → 小窓（lg 960px）
┌ 1527681 山田 太郎 ─────────────────────────────── × ┐
│ 左：受注日・エントリー日・申込送付日・請求送付日・入金確認・取消日・進捗     │
│     区分・獲得手法・契約種別・動力申込・申込プラン・請求金額・受注者・事務担当 │
│ 右：お客様名（カナ）・使用場所の住所・電話・電灯/動力/ガスのお客様番号と供給地点 │
│ 写メ（4 枚）  [画像][画像][画像][画像]   ← 押すと大きく表示・［画像を保存］     │
│ 備考                                                                       │
└──────────────────────────────────────────┘
```
- タブ：進行中＝取消日なし かつ 進捗が「エントリー完了」でない／完了＝進捗「エントリー完了」で取消日なし／キャンセル＝取消日あり または 進捗に「キャンセル」を含む
- 列のそろえ方：管理番号・日付・区分・進捗＝中央／写メ枚数・請求金額＝右／名前・契約種別・担当＝左
- 検索の薄い字：「管理番号・お客様名・カナ・住所」
- 写メは画像で表示し、保存も画像（jpg）のまま。PDF は画面に出さない
- 写メは非公開バケット `leaf-kanden-photos`。小窓を開いたときにサーバーで 1 時間の署名 URL を作って返す（画像の加工・縮小のサービスは使わない＝料金のため）。`loading="lazy"`

## やること
### 1. 表 `leaf_kanden_orders`（FileMaker の受注の写し）migration `supabase/migrations/20261120000537_leaf_kanden_orders.sql`
- 列：id uuid pk default gen_random_uuid()／fm_pk numeric not null unique（FileMaker の主キー）／kanri_no text（`normalizeKanriNo` 済み）／kanri_no_raw text／ordered_on・entered_on・specs_on・app_sent_on・invoice_sent_on・cancelled_on date／payment_confirmed・fc_result・progress・acquisition（奪還/囲込）・acquisition_method・order_method・sales_name・clerk_name・list_name・contract_type・power_apply・plan・customer_name・customer_kana・postal_code・address・phone・denki_customer_no・denki_supply_point・douryoku_customer_no・douryoku_supply_point・gas_customer_no・gas_supply_point・note text／billing_amount numeric／fm_created_at・fm_updated_at timestamptz／imported_at timestamptz not null default now()
- index：kanri_no・ordered_on・cancelled_on
- RLS 有効・ポリシーなし（読み書きはサーバーのサービスロールだけ）
- 取り込みの記録 `leaf_kanden_import_runs`（id・source text・rows integer・started_at・finished_at）＝画面の「最終更新」に使う

### 2. 取り込みスクリプト `scripts/leaf-kanden-orders/import-fm-csv.ts`
- 引数 `--csv <パス>`・`--dry-run`。CSV は UTF-8（BOM あり）・1 行目が見出し。見出しは FileMaker の項目名（下の表）
- 1000 行ずつ `fm_pk` で upsert。終わったら `leaf_kanden_import_runs` に 1 行
- 日付：`YYYY-MM-DD`（`(日付不正)` や読めない値は null）。時刻つきの値はそのまま timestamptz
- 項目の対応（FileMaker → 列）：主キー→fm_pk／管理番号→kanri_no_raw（kanri_no は `src/lib/leaf-kanden/kanri-no.ts` の normalizeKanriNo）／受注日→ordered_on／エントリー日→entered_on／諸元回収日→specs_on／申込Excel送付日→app_sent_on／請求Excel送付日→invoice_sent_on／取消日→cancelled_on／入金確認→payment_confirmed／FC結果→fc_result／進捗→progress／区分_奪還囲込→acquisition／獲得手法→acquisition_method／受注手法→order_method／受注者→sales_name／事務担当者→clerk_name／リスト名→list_name／契約種別→contract_type／動力申込→power_apply／申込ﾌﾟﾗﾝ→plan／請求金額→billing_amount／新契約者名義_漢字（空なら 現契約名義_漢字）→customer_name／新契約者名義_カナ（空なら 現契約名義_カナ）→customer_kana／新使用場所住所_〒（空なら 現使用場所住所_〒）→postal_code／新使用場所住所1＋2（空なら 現使用場所住所1＋2）→address／電話番号1→phone／電灯_お客様番号→denki_customer_no／電灯_供給地点特定番号→denki_supply_point／動力_お客様番号→douryoku_customer_no／動力_供給地点特定番号→douryoku_supply_point／ガス_お客様番号→gas_customer_no／ガス_供給地点特定番号→gas_supply_point／備考→note／作成日→fm_created_at／修正日→fm_updated_at
- 純粋な部分（1 行の変換）は `import-fm-csv.core.ts` に分けてテスト

### 3. Leaf を社長スタイルに
- `src/app/leaf/layout.tsx`：Soil と同じく ModuleShell の社長スタイルの外枠（`LeafShell` を作り直す・`SoilShell` と同じ作り）。左メニュー：「概要」（/leaf）・「関電 案件一覧」（/leaf/kanden）
- 閲覧権限：`leaf-overview`（今のまま）と `leaf-kanden`（新設・既定は manager 以上）。歯車で役職・個人ごとに変えられる（Soil の `soil-view-scopes.ts` と同じ作り）
- `/leaf`（概要）も社長スタイルの型にする（中身は今の事業カードのままでよい。絵文字・金色・明朝は消す）
- 旧 `/leaf/kanden/input`・`/leaf/kanden/backoffice` と `/api/leaf/prototype` と `src/app/leaf/_templates/*.html` は**消す**（`/leaf/kanden/backoffice` は `/leaf/kanden` へ転送）。旧 view-scope のキー（leaf-kanden-input・leaf-kanden-backoffice）は保存済みの設定を壊さないよう、定義から外すだけにする

### 4. 関電 案件一覧 `/leaf/kanden`
- 上の絵のとおり。部品＝SystemBreadcrumb・UpdatedStamp（取り直し不可＝グレー）・SystemTabs（`?tab=`）・BoxSelect（年度）・DataTable（`onRowClick`・`searchPlaceholder`）・共通 Modal（size="lg"）
- データ：サーバーで年度（4/1〜3/31）とタブで絞って返す。写メ枚数は `leaf_kanden_photos` を kanri_no で数える（1 回の集計クエリで。行ごとに問い合わせない）
- 小窓の写メ：server action で kanri_no の写メを日付・object_key 順に返し、署名 URL（1 時間）を付ける。画像を押すと小窓の中で大きく表示（前後に移れる）。［画像を保存］はその jpg をダウンロード（`download` 属性のファイル名＝`<管理番号>_<連番>.jpg`）
- データが 0 件のとき：「FileMaker の受注はまだ取り込まれていません。」
- 読み込みに失敗したとき：社長スタイル §3-6 の文言

## 守ること
- **git 操作禁止（commit・add・push・checkout すべて）**
- **ブラウザ・computer-use・画面操作は禁止**
- **本番 DB・Storage・Kintone への書き込み禁止**（migration と取り込みはファイルを書くだけ。動かすのは Claude）
- 画面ごとに css で色・部品を作らない（共通部品と社長スタイルの変数だけ）。絵文字・明朝・金色なし。画面の文字はきちんとした日本語・開発者用語なし
- 改行は LF のまま。関係ないファイルは触らない
- Vercel の呼び出しを増やさない（cron を足さない）。報告に「Vercel 呼び出し 0 回/日」の見積もりを書く

## 確かめ
- `npx vitest run src/app/leaf src/lib scripts/leaf-kanden-orders` が緑（leaf の既存テストは新しい形に直す）
- `npx tsc --noEmit` でエラーなし

## 報告
`docs/dispatches/report-codex-537-leaf-shacho-kanden-cases-20261120.md` に、作った・消したファイル、テスト結果、気になった点を書く。
