# Codex-520 付与ポイント表を作る（2026-11-12）

作業場所：`C:\garden\a-bloom-008`（main）

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない（migration はファイルを作るだけ。当てるのは Claude）。Kintone・Chatwork を本当に呼ばない。`vercel.json` の crons に足さない。** ファイルは UTF-8。文字化け（??）を残さない。必要な範囲だけ読む。
画面の文字はきちんとした日本語。英語・開発者用語・略称を出さない。**コードは周りと同じく読みやすく書く**（1行に詰め込まない）。

## 読むもの

- `supabase/migrations/20260903000001_system_kanri_portal_stage2.sql`（今の `system_kanri_point_master`。表記ゆれ `kintone_names` の考え方を引き継ぐ）
- `src/app/system/kanri/_lib/calc/kanri-sheet.ts` の `productAliasMap`
- `src/app/system/sites/`（社長スタイルの画面の例）、`src/app/system/list/`
- `src/lib/auth/permission-registry.ts`、`src/lib/auth/system-view-scopes.ts`
- 社長スタイルの部品：`SystemBreadcrumb`・`UpdatedStamp`・`DataTable`・`form-kit`

## 背景（東海林さんの決定）

コール集計の配信・管理表・今後の顧客管理で使う「付与ポイント」を、Garden のデータベースに 1 本だけ持つ。

- 月ごと（月の途中もある）にポイントが変わるので、**期間（開始日・終了日）** を持つ。どの期間を使うかは**受注日**で決める
- 同じ商材でも**獲得方法（白地／LP／アライアンス）** でポイントが変わることがある
- 合計付与P ＝ トス付与P ＋ クローザー付与P（必ず合う）
- トス付与P は基本 0.2。商材によって変えられる
- 顧客一覧（Kintone）の「付与件数」は営業側で入力されておらず使えない。Garden の表で置き換える
- 管理表ポータルの `system_kanri_point_master` は**今回は触らない**（あとで新しい表を読むよう切り替える）

## データ

`supabase/migrations/20261112000520_soil_product_points.sql`（ファイルを作るだけ）。

表 `public.soil_product_points`：

| 列 | 型 | 中身 |
|---|---|---|
| id | uuid | 主キー |
| product | text not null | 商材名（例：AU光） |
| channel | text not null | 獲得方法。`hakuchi`（白地）／`lp`（LP）／`alliance`（アライアンス） |
| category | text not null | 区分。`kaisen`（回線）／`credit`（クレカ）／`denki`（電気ガス） |
| report_group | text not null | 配信の内訳。`collab`（コラボ）／`au`（AU）／`credit`（クレカ）／`nuro`（NURO）／`denki`（でんき）／`other`（その他） |
| start_date | date not null | 開始日 |
| end_date | date | 終了日（空＝今も有効） |
| total_points | numeric(6,2) not null | 合計付与P |
| toss_points | numeric(6,2) not null default 0.2 | トス付与P |
| closer_points | numeric(6,2) generated always as (total_points - toss_points) stored | クローザー付与P |
| unit_price | integer | 金額（円）。管理表で使う |
| has_option | text | OP有無（あり／なし／空） |
| kintone_names | text[] not null default '{}' | Kintone 側の表記ゆれ |
| sort_order | integer not null default 100 | 並び順 |
| note | text | 備考 |
| updated_at / updated_by | | 最終更新 |

- `check (toss_points >= 0 and toss_points <= total_points)`、`check (end_date is null or end_date >= start_date)`
- **同じ product・channel で期間が重ならない**：`btree_gist` の exclude 制約（`daterange(start_date, coalesce(end_date, 'infinity'), '[]')`）。拡張が使えないなら、重なりを断る trigger にする
- RLS：見る＝責任者以上（`has_role_at_least('manager')`）。書き込みは service_role だけ（画面はサーバー側の API から書く）
- 関数 `public.soil_product_point_at(p_product text, p_channel text, p_date date)`：表記ゆれも含めて商材を探し、その日に有効な 1 行を返す。読み取りだけ・`security invoker`

### 初期値（`C:\Users\shoji\Downloads\【管理表】実件数報告_20261111.xlsm` の「付与ポイント」シート＝東海林さんいわく最新で正しい）

開始日はすべて **2026-11-01**、終了日は空。**白地・LP・アライアンスの 3 行を同じ値で入れる**（27 商材 × 3 ＝ 81 行）。

トス付与P のきまり（シートの注記より）：区分が回線 → **0.2**（残りがクローザー）。クレカ・電気ガス → **合計と同じ**（アポを取った人に満額。クローザーは 0）。

| 商材 | 区分 | 配信の内訳 | 合計P | 金額 | OP |
|---|---|---|---|---|---|
| BIGLOBE光 | 回線 | コラボ | 1.2 | 32000 | あり |
| Docomo光 | 回線 | コラボ | 1.3 | 61000 | なし |
| AU光 | 回線 | AU | 1.6 | 83500 | あり |
| JUST光 | 回線 | コラボ | 1.0 | 0 | |
| Ichi光 | 回線 | コラボ | 1.2 | 0 | |
| NURO光 | 回線 | NURO | 1.4 | 86000 | なし |
| So-net光 | 回線 | コラボ | 1.0 | 65750 | あり |
| Softbank光 | 回線 | コラボ | 1.0 | 30000 | |
| さすがネット | 回線 | その他 | 0.2 | 42000 | |
| SoftbankAir レンタル | 回線 | その他 | 0.2 | 12000 | |
| SoftbankAir 割賦 | 回線 | その他 | 1.0 | 52000 | |
| au光プラス タイプ1 | 回線 | AU | 1.6 | 52500 | |
| au光プラス タイプ3 | 回線 | AU | 1.2 | 39000 | |
| JCB Biz ONE | クレカ | クレカ | 0.4 | 20000 | |
| 三井住友カード（NL） | クレカ | クレカ | 0.1 | 6000 | |
| 三井住友ビジネスオーナーズ（SMCCAV） | クレカ | クレカ | 0.3 | 17500 | |
| セゾン（発行のみ） | クレカ | クレカ | 0.4 | 28000 | |
| ライフカードビジネスライト | クレカ | クレカ | 0.3 | 12500 | |
| 三菱UFJニコス | クレカ | クレカ | 0.3 | 16000 | |
| ACマスター | クレカ | クレカ | 0.4 | 25000 | |
| ドコモでんき | 電気ガス | でんき | 0.3 | 14000 | |
| 大阪ガス電気セット | 電気ガス | でんき | 0.2 | 5000 | |
| オクトパスエナジー | 電気ガス | でんき | 0.2 | 7000 | |
| エバーグリーン電気　GPプラン | 電気ガス | でんき | 0.4 | 32000 | |
| エネワン電気 | 電気ガス | でんき | 0.2 | 5000 | |
| アースインフィニティ | 電気ガス | でんき | 0.4 | 18000 | |
| プライム電気(JAPAN電力) | 電気ガス | でんき | 0.4 | 30600 | |

OP 列はシート 7 行目（B〜H 列。E・F 列は空）。数字はシートの 5・6 行目。**シートを開いて上の表と一致するか確かめる**（違えばシートを正とし、報告に書く）。

`kintone_names`：商材名そのものに加え、今の `system_kanri_point_master.kintone_names` にある表記（例：AU光＝`au光　Sonet`・`au光　BIGLOBE`・`au光`、Docomo光＝`docomo光`、JCB Biz ONE、`三井住友カード（NL）` など）を引き継ぐ。全角スペース・半角スペースのゆれ（`SoftbankAir　割賦`）も足す。`au光プラス`（タイプなし）は、どちらのタイプか分からないので**入れない**。

## 計算の部品

`src/lib/product-points/` に純粋な関数を置き、テストする。

- `resolveChannel({ 事業名, リスト名 })`：事業名が「アライアンス」→ alliance／事業名が「自社」でリスト名が `WEB_` で始まる → lp／それ以外の「自社」→ hakuchi／どれでもない → null
- `pointFor(rows, { productName, channel, orderDate })`：表記ゆれで商材を探し、受注日が期間に入る行を返す。見つからなければ null（呼ぶ側で「表にない商材」として数える）
- `sumPoints(orders, rows)`：合計・獲得方法ごと・配信の内訳ごと・表にない商材の一覧を返す

Kintone から読む処理は**今回作らない**（配信の直しは次の指示書）。

## 画面 `/system/product-points`「付与ポイント表」

```
System ＞ 付与ポイント表                          最終更新：2026-11-12 14:03:22
 獲得方法 [白地][LP][アライアンス]   区分 [回線][クレカ][電気ガス]   ☐ 終わった期間も出す
 ┌──────────────┬────┬────┬──────┬──────┬────────┬──────────┬──────────┐
 │商材            │区分│獲得 │合計P │トスP │クローザーP│開始日      │終了日      │
 ├──────────────┼────┼────┼──────┼──────┼────────┼──────────┼──────────┤
 │AU光            │回線│白地 │  1.6 │  0.2 │    1.4   │2026-11-01 │            │
 │ …
 └──────────────┴────┴────┴──────┴──────┴────────┴──────────┴──────────┘
                                                        ［追加する］
```

- 社長スタイル（`garden-style` スキル・正本 §2.5／§2.6）。`SystemBreadcrumb`・`UpdatedStamp`・`DataTable`
- 絞り込みは `BoxSelect`。既定＝今日有効な行だけ
- **行全体を押すと小窓**で変更（`onRowClick`。［変更する］列は置かない）。小窓はスクロールバーを出さない
- 小窓の欄：商材・獲得方法（ラジオ）・区分（ラジオ）・配信の内訳（select）・合計付与P・トス付与P（新規の初期値 0.2）・クローザー付与P（自動・見るだけ）・開始日・終了日・金額・OP有無・Kintone での表記（1 行に 1 つ）・備考。`form-kit` の部品を使う
- **ポイントが変わるとき**のボタン［この日から新しいポイントにする］：日付と新しい値を入れると、今の行の終了日を前日にして新しい行を作る（1 回の保存で 2 行、途中で失敗したら両方戻す＝DB の関数でまとめて行う）
- 期間が重なるときは、選ぶ欄とボタンの間、**画面の上**に「同じ商材・獲得方法で期間が重なっています（2026-11-01〜）」と出す
- 見る＝責任者以上、変更＝全権管理者。見るだけの人には［追加する］と小窓の保存を出さない
- 楽観更新（押したらすぐ表に出す。失敗したら戻して上に知らせる）。開いた瞬間のちらつきを出さない（`src/lib/ui/no-flicker-source.test.ts`）
- 幅 4 段階・ライト／ダーク・スマホで崩れない

## 権限・入口

`permission-registry.ts`・`system-view-scopes.ts` に「付与ポイント表」を足す。System のホームのメニューにも足す。Garden 全体の検索に出す必要はない。

## マニュアル 5 点（⓪①②③④）

`C:\Claude\000_Garden\150_System_システム\00_マニュアル\34_付与ポイント表\` を新しく作る。ほかのマニュアル（例：`33_派遣管理`）の形とファイル名にそろえる。④を先に書き、版 v1.0・日付 2026-11-12。①は「使い方」の書き方（業務の言葉で短く・タブごとの章立て）。略称を使わない。**Storage へは上げない**。

## テスト

期間の重なりを断る／終了日が空の行と新しい行／受注日が開始日・終了日ちょうど／表記ゆれ（全角・半角スペース）／表にない商材／獲得方法の判定 3 種と null／トス付与P がクローザーを超えない／クローザー＝合計−トス／「この日から新しいポイント」で 2 行になり、失敗したら戻る／見るだけの人に保存が無い／初期値 81 行。
`npx tsc --noEmit`、`npx vitest run src/lib/product-points src/app/system/product-points src/lib/auth/permission-registry.test.ts src/lib/auth/system-view-coverage.test.ts src/lib/ui/no-flicker-source.test.ts` が通ること。

## 終わったら

`docs/dispatches/report-codex-520-product-points-table-20261112.md` に、直したファイル・migration・テスト結果・シートとの違い・作れなかったものを書く。
