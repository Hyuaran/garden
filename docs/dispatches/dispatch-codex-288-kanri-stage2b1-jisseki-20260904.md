# Codex-288 管理表ポータル 段階2b-1：「【入力】実績管理」を Garden で計算する

作成日: 2026-09-04
作業ツリー: C:\garden\a-bloom-008
起点: main **88f299c**（段階2a 本番稼働）
**git は触らないこと。SQL・migration を書かないこと（表は Claude が用意・東海林さんが実行）。本番のデータ・Storage・ドライブに触らないこと。**

必ず先に読むもの：
- 正本（④）：C:\Claude\000_Garden\150_System_システム\00_マニュアル\07_管理表ポータル\Garden_System_管理表ポータル_4_仕様書_Claude読み込み用.md
- 設計書：C:\Claude\000_Garden\150_System_システム\04_管理表ポータル\004_設計_段階2b_3_4_残りのシートとKOT.md（1-1 実績管理・2 画面の絵・3 データ）
- 前の指示書：C:\garden\a-bloom-008\docs\dispatches\dispatch-codex-287-kanri-stage2a-20260903.md と 287b（golden の作法・既知の差分）

## 0. 何を作るか

Excel「【入力】実績管理」シート（人ごとの月次集計・58 種類の式・1,636 セル）を Garden が計算する。段階2a（【入力】管理表）と同じ作法：純粋関数で計算 → 8/31 の Excel の値と全セル一致 → 画面はタブで表示。**現場には出さない。東海林さんが並行運用する。**

## 1. データ（Claude が用意ずみ。SQL を書かないこと）

### 1-1. 新しい表 system_kanri_person（C:\garden\a-bloom-008\supabase\migrations\20260904000002_system_kanri_person.sql・東海林さんが実行）

| 列 | 中身 |
|---|---|
| name | Excel・Kintone の表記（姓と名の間は**全角スペース**。例「宮永　ひかり」） |
| kot_name | KOT の表記（半角スペース。例「宮永 ひかり」） |
| team | Excel F 列（宮永チーム／小泉チーム／石原チーム／チーム／訪問営業） |
| department | Excel E 列（宮永チーム／小泉チーム／石原チーム／社員／関電） |
| employment_kind | 社員／アルバイト／派遣 |
| base_wage | 基準時給（アルバイトのみ。社員・派遣は null） |
| is_field_sales | 訪販（関電）の人 |
| employee_id | 従業員台帳 root_employees との紐づけ（任意・後で） |
| active, sort_order | |

初期値は 8/31 の実績管理シート B〜F 列の 28 人。

### 1-2. 手入力（system_kanri_result・sheet='inputs'・既存の JSON に項目を足す）

```
{
  hoursByTeamByDate: {...}, openRateByTeamByProduct: {...},        // 2a のまま
  personMonthly: {                                                 // 2b-1 で追加（KOT が自動になるまでのつなぎ）
    "宮永　ひかり": { landingHours: 215, workHours: 215, workDays: 26 },   // 着地予想h・稼働時間h・稼働日数
    "萩尾　拓也":   { workHours: 147, fieldPoints: 27.6 }               // 訪販の人：稼働h と 合計評価実績（2b-3 で自動になるまで）
  },
  monthlySettings: {                                               // 2b-1 で器を作る（使うのは 2b-2／2b-4）
    targetPointsByTeam: { "テレマ全体": 240, "宮永チーム": 80, "小泉チーム": 80, "石原チーム": 80, "新人チーム": 0 },
    incentive: { targetPoints: 300, achievementBonusTotal: 192000, teamVictoryBonus: 0 }
  }
}
```

- 読み書きは今の `/api/system/kanri/inputs/[yearMonth]`（月内の最新の手入力を引き継ぐ仕組みはそのまま）
- **「今月の設定」（monthlySettings）の決まり**：月に 1 度入れればその月に適用。月の途中でも変更でき、変更したら計算し直す。**前月の値を初期表示**する（その月に保存が無ければ前月の monthlySettings を返す。無ければ空）

### 1-3. 交通費（往復）

従業員台帳 root_employees の `commute_daily_allowance`（日額＝往復。片道×2 の決まり）を **氏名で突き合わせて**使う。台帳の氏名の列名・表記（全角／半角スペース）は Codex が実物のコードで確認して、person.name と kot_name の両方で当てる。台帳に無い人は 0 で、画面に「台帳に交通費が無い人」を注意として出す。

## 2. 計算のルール（Excel の式から起こした。C:\Claude\...\002_計算式の棚卸し_317種類.md の「【入力】実績管理」の章が元）

人ごとに 1 行。対象は system_kanri_person の active な人（sort_order 順）。

| Excel の列 | 中身 | 出どころ |
|---|---|---|
| B 氏名／C KOT用 | person.name／kot_name | 設定 |
| D 基準時給 | 社員→「社員」、派遣→「派遣」、アルバイト→base_wage | 設定 |
| E 部署名／F チーム名 | person.department／team | 設定 |
| G 着地予想 | personMonthly.landingHours | 手入力（つなぎ） |
| H 稼働時間 | テレマ＝personMonthly.workHours／訪販＝personMonthly.workHours | 手入力（つなぎ） |
| I 合計獲得P | テレマ＝下の式／訪販＝personMonthly.fieldPoints | 計算／手入力 |
| J 時間効率 | I ÷ H（H が 0 なら 0。Excel は IFERROR(…,0)） | 計算 |
| K 稼働日数 | personMonthly.workDays | 手入力（つなぎ） |
| L 交通費往復 | 従業員台帳の commute_daily_allowance | 台帳 |
| M〜AO 件数 | 商材ごとの件数。**光回線 9 商材は 2 列ずつ（トス／AP）**、クレカ 7 商材は 1 列、でんき 4 商材は 1 列 | 計算 |

**件数の数え方**（取り込んだ生データ system_kanri_source_row・run の月の分）
- 光回線（kintone_customer）：商材名区分2 を point_master.kintone_names で束ねる。**トス列＝トス名がその人**の件数、**AP列＝AP名がその人**の件数
- クレカ（credit_card）：**AP名（D 列）がその人**の件数だけ。商材名区分2 で商材を決める
- でんき（ドコモでんき・大阪ガス電気セット・オクトパスエナジー・さすガねっと）：kintone_customer の **トス名がその人**の件数
- 名前の比較は全角スペース表記（person.name）。半角スペース・前後の空白は正規化してから比べる

**合計獲得P（I 列）**
- 光回線：`AP件数 × (係数 − 0.2) ＋ トス件数 × 0.2`（係数＝point_master.coefficient。例 BIGLOBE光 1.2 → AP 1.0・トス 0.2）
- クレカ・でんき：`件数 × 係数`
- 商材ごとの係数の並びは point_master。商材の列順も point_master.sort_order（20 商材。Excel の実績管理も 20 商材）

**関電（訪販）の人**：M〜AO は全部 0。H と I は手入力（2b-3 で訪問販売シートから自動になる）。

## 3. 画面（/system/kanri をタブ化）

```
System ／ 管理表ポータル
 対象日 [2026/09/04] 種類 (●デイリー ○締めチェック)  [データを取り込む]   [計算する]（全シート一括）
 [管理表] [実績管理] [設定]                  ← 2b-1 では 3 タブ。今の画面の枠は「管理表」タブへそのまま移す

 ── 実績管理 タブ ──
 ┌ 今月の設定（月に1度・途中変更可・前月の値を初期表示） ──────────────────────┐
 │ 目標P：テレマ全体 [240] 宮永 [80] 小泉 [80] 石原 [80] 新人 [0]                      │
 │ インセ：目標P [300] 達成金合計 [192,000] チーム勝利金 [0]                    [保存]  │
 └────────────────────────────────────────────────────────┘
 ┌ 人ごとの今月の値（KOT が自動になるまで手入力） ───────────────────────────┐
 │ 氏名          チーム    区分/時給   着地予想h  稼働時間h  稼働日数  訪販の合計評価    │
 │ 宮永 ひかり    宮永      社員       [215 ]    [215 ]    [26 ]                       │
 │ 田中 実花      小泉      1,400      [129 ]    [129 ]    [15 ]                       │
 │ 萩尾 拓也      訪問営業  社員                 [147 ]              [27.6 ]           │
 │ …（設定の人が sort_order 順に並ぶ）                                        [保存]  │
 └────────────────────────────────────────────────────────┘
 ┌ 実績管理（計算結果・Excel と同じ並び） ──────────────────────────────────┐
 │ 氏名 | KOT用 | 基準時給 | 部署 | チーム | 着地 | 稼働h | 獲得P | 効率 | 日数 | 交通費 | BIGLOBE光 トス | AP | Docomo光 トス | AP | … | JCB | … | さすガねっと │
 │ （横スクロール。見出し行と氏名列は固定。交通費が台帳に無い人は注意に名前を出す）        │
 └────────────────────────────────────────────────────────┘

 ── 設定 タブ ──
 ┌ 人の設定 ──────────────────────────────────────────────────┐
 │ 氏名 | KOT用 | チーム▼ | 部署▼ | 区分▼(社員/アルバイト/派遣) | 基準時給 | 訪販☐ | 有効☐   [行を足す] [保存] │
 └────────────────────────────────────────────────────────┘
```

- 「計算する」は 1 回で管理表（2a）と実績管理の両方を計算し、sheet='kanri' と sheet='jisseki' に保存する
- 表示の丸め：時間 小数 1 桁、効率 小数 3 桁（Excel は生の値。表示だけ丸める）、ポイント 小数 1 桁、金額 3 桁区切り
- 絵文字を使わない。画面に開発者用語（run／grid／fixture／JSON）を出さない。チーム・商材・人をコードに直書きしない

## 4. 作るもの（ファイル）

- 計算部品 `src/app/system/kanri/_lib/calc/jisseki-sheet.ts`（純粋関数。入力＝生データ・point_master・person・personMonthly・交通費の対応表。出力＝人ごとの行と cellValues＝Excel のセル番地→値）
- 答え合わせ `src/app/system/kanri/_lib/calc/jisseki-sheet.golden.test.ts`（5 章）
- 単体テスト `jisseki-sheet.test.ts`（トス／AP の分け方・−0.2 の決まり・クレカは AP だけ・でんきはトスだけ・訪販の人・台帳に無い交通費）
- API：`/api/system/kanri/people`（GET／PUT・manager 以上・system_kanri_person の読み書き）、既存 `inputs` に personMonthly と monthlySettings（前月引き継ぎ）、既存 `calculate` で jisseki も計算・保存、既存 `result?sheet=jisseki`
- 画面：`KanriPortalClient.tsx` をタブ化（管理表／実績管理／設定）。大きくなるならタブごとに部品ファイルへ分けてよい

## 5. 答え合わせ（golden）

`KANRI_FIXTURES_DIR`（Claude が指定。C:\Claude\000_Garden\150_System_システム\04_管理表ポータル\fixtures\2026-08-31）の JSON を使う。

- 入力：`入力_Kintone.json`（2 行目見出し・3 行目から）、`クレジットカード.json`（1 行目見出し・2 行目から）、`付与ポイント.json`（3 行目見出し・4 行目係数・5 行目単価。見出しと管理表の商材名の対応は 287b の golden と同じ表を使う）、`入力_実績管理.json` の **B〜F（人の設定）・G・H・K（personMonthly）・訪販の人の H と I（fieldPoints）**、`交通費.json`（A 列 氏名 → I 列 往復）
- 期待値：`入力_実績管理.json` の **I・J・M〜AO**（28 人分）と L（交通費）
- 一致の判定は 287b と同じ（数値は 1e-6、#N/A・#DIV/0! は null、空は 0 または null）
- **Excel の答えから係数や件数を逆算しない**。合わないセルは「セル番地・期待値・実際の値」を全部出す。Excel 側の癖が見つかったら、除外せずに期待値側で補正し、理由をコメントに書いて 8 章に足す
- 名前の表記ゆれ（全角／半角スペース）で件数が合わないときは、正規化のルールを部品に入れる（テストで固定）

## 6. 変えてはいけないもの

- 段階1 の取り込み、2a の計算部品と golden（jisseki の追加で壊さない）、Kintone 取得部品、AppHeader とそのテスト、見出し「System / 管理表ポータル」
- SQL・migration（用意ずみ）、本番のデータ・Storage・ドライブ、fixtures（読むだけ）

## 7. 受け入れ基準

1. npx vitest run src/app/system/kanri src/app/api/system/kanri が通る（合否行を読む）
2. npx tsc --noEmit に今回の変更由来のエラーが無い
3. **KANRI_FIXTURES_DIR 指定の golden（jisseki）で、I・J・L・M〜AO が 28 人分すべて一致**（補正があれば理由つき）。2a の golden も引き続き一致
4. トス／AP の数え分けと −0.2 の決まりが設定表（係数）から来ていて、コードに商材名・係数の直書きが無い
5. 「今月の設定」：保存 → 読み直し → **翌月の初期表示に前月の値が出る**（テストで確かめる）
6. 人の設定：追加・変更・無効化が画面からでき、次の計算に反映される
7. 「計算する」1 回で管理表と実績管理の両方が保存され、タブで表示される（横スクロール・見出し行と氏名列固定）
8. manager 未満は 403（people・inputs・calculate・result）
9. 絵文字なし・開発者用語なし・変更した TS/TSX の ESLint が通る
10. テストを足してある（golden／トス AP／訪販／交通費なし／今月の設定の引き継ぎ／権限）

**実画面での確認は Claude が行う。本番 DB には触らない。SQL も git も触らない。**

## 8. 完了報告（コードブロックで出力）

- 「未コミット」と明記／変更・追加ファイルのフルパス／受け入れ基準 1〜10 の結果（3 は「一致 ○○セル／不一致 ○○セル」）／本番 DB・Storage・ドライブ・git・SQL に触っていないことの明記／Excel の癖を見つけたら 9 章に

## 9. 既知の差分（2026-09-07・Claude が追記）

- **I8／J8（石原 孝志朗の合計獲得P・時間効率）**：Excel は 36.9、件数×係数で計算すると 36.5。管理表の BE5 と同じ「石原チームに +0.4 の手打ち」。Garden は設定表どおり 36.5（東海林さん決定＝Garden が正）。golden は期待値側を 36.5 に補正
- Codex は「L11（南薗 優樹の交通費）が交通費シートに無い」と報告したが、テスト側が交通費シートを 200 行までしか読んでいなかったのが原因（実物は A426 にあり 380 円）。Claude がテストを全行読みに直し、L11 は補正なしで一致
