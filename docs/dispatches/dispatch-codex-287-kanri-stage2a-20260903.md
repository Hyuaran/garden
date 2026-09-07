# Codex-287 管理表ポータル 段階2a：「【入力】管理表」を Garden で計算する

作成日: 2026-09-03
作業ツリー: C:\garden\a-bloom-008
起点: main **91a9cbc**
ブランチ: 切らない。**git は触らないこと**。ファイル変更までで、コミットは人間側が行う。

**東海林さん承認ずみ（2026-09-03）。納期は 1 週間（両トラック並行）。**

## 0. 背景と方針（確定）

- 管理表 Excel の計算は **Garden 自身が行う**（Excel に流し込まない）。実測で exceljs は再計算せず、書き戻すと Excel で開けなくなるため
- 計算式 7,143 個の実体は **317 種類**。棚卸し：
  C:\Claude\000_Garden\150_System_システム\04_管理表ポータル\002_計算式の棚卸し_317種類.md
- **答え合わせの正＝8/31 の稼働版が Excel で計算した値**（JSON に抜き出しずみ）：
  C:\Claude\000_Garden\150_System_システム\04_管理表ポータル\fixtures\2026-08-31\（manifest.json ＋ シートごとの JSON。キー＝セル番地、値＝Excel の計算結果）
- 段階1（Codex-286・本番稼働）で、Kintone 10 アプリ＋名簿の生データは system_kanri_source_row に月単位で貯まっている
- 今回（2a）は **「【入力】管理表」シートだけ**を Garden で再現する。アポラン・実績管理・訪問販売・インセ計算・給与計算用は 2b（Codex-288）

## 1. データベース（Claude が用意ずみ。SQL を書かないこと）

C:\garden\a-bloom-008\supabase\migrations\20260903000001_system_kanri_portal_stage2.sql（東海林さんが実行）

| 表 | 役割 |
|---|---|
| system_kanri_point_master | 付与ポイント（Excel の「付与ポイント」シートの置き換え）。product（管理表の列名）・kintone_names（Kintone 側の表記のゆれ）・category・coefficient（係数）・unit_price（単価）・has_option・sort_order |
| system_kanri_team | チーム（列ブロック）。宮永チーム／小泉チーム／石原チーム を初期値で投入ずみ |
| system_kanri_result | 計算結果。run_id × sheet ごとに grid（JSON） |

**初期値は 8/31 の付与ポイントシートそのまま**。AU光の kintone_names（"au光　Sonet","au光　BIGLOBE"）は 8/31 の式から取った。

## 2. 「【入力】管理表」の構造（8/31 実物）

```
　行 8〜38 ＝ その月の日（B=日番号 or 「定休日」、C=日付、D=曜日）
　列は 全体（E〜G）＋ チームごとの列ブロック（宮永 I〜AD ／ 小泉 AF〜BA ／ 石原 BC〜BX）

　　　　  E:ALL h   F:稼働効率   G:合計   ｜ I:h  J:稼働効率  K:合計  L:BIGLOBE光  M:Docomo光 … AD:さすガねっと ｜ AF:h …
　2行                                  ｜               L2〜AD2 ＝ 開通率（商材×チーム。手入力。例 0.84）
　4行  ALL 実数   E4=SUM(E8:E38) F4=G4/E4 G4=K4+AH4+BE4 ｜ K4=SUM(K8:K38) L4=SUM(L8:L38) …
　5行  ALL ポイント                      ｜ L5 = L4 × 付与ポイント!係数（BIGLOBE光=1.2）… K5=SUM(L5:AD5)
　6行  金額                             ｜ L6 = 付与ポイント!単価 × L2（開通率）× L4   K6=SUM(L6:AD6)  E6=G6/E5
　8行〜 日ごと   E8=I8+AF8+BC8（各チームの h の合計）  F8=G8/E8  G8=K8+AH8+BE8
　　　　                                 ｜ I8 = その日のチームの稼働時間（★手入力。設計書の「1部h/2部h」）
　　　　                                 ｜ L8 = COUNTIFS(Kintone.実績日=C8, Kintone.チーム名="宮永チーム", Kintone.商材名区分2="BIGLOBE光")
　　　　                                 ｜ N8（AU光）= "au光　Sonet" と "au光　BIGLOBE" の合計
　　　　                                 ｜ T8〜Z8（クレカ）= COUNTIFS(クレジットカード.紹介日=C8, チーム名, 商材名区分2="JCB Biz ONE" 等)
　　　　                                 ｜ AA8〜AD8（でんき等）= Kintone の 商材名区分2
　　　　                                 ｜ K8 = SUM(L8:AD8)   J8 = K8/I8
```

- 「定休日」の行は h=0・合計 0・稼働効率は割れない（Excel は #DIV/0!）→ Garden では **null** にする
- 石原チームの BE5 に `+0.4` の手打ち補正がある（8/31 の式 `SUM(BF5:BX5)+0.4`）。**再現しない**。差分として記録する（8 章）

## 3. 作るもの

### 3-1. 計算部品 C:\garden\a-bloom-008\src\app\system\kanri\_lib\calc\kanri-sheet.ts

入力（すべて純粋な値。DB や API に触らない）
- 対象月の日リスト（定休日の日付集合を含む：system_kanri_month_setting.holidays）
- 光回線の行（source kintone_customer の payload：実績日・チーム名・商材名区分2 …）
- クレジットカードの行（source credit_card の payload：紹介日（日付_4）・チーム名（文字列__1行__26）・商材名区分2（ドロップダウン_12））
- 付与ポイント（system_kanri_point_master の行）
- チーム（system_kanri_team の行）
- **手入力**：チーム×日の稼働時間 h、チーム×商材の開通率（3-3 の入力から）

出力（grid）
```
{
  days: [{ day: 1|"定休日", date: "2026-08-01", weekday: "土",
           all: { hours, efficiency, total },
           teams: { "宮永チーム": { hours, efficiency, total, products: { "BIGLOBE光": 3, … } }, … } }, …],
  totals: { all: { hours, efficiency, total, amount }, teams: { "宮永チーム": { hours, efficiency, total, points, amount, products: {…}, pointsByProduct: {…}, amountByProduct: {…} } } },
  openRate: { "宮永チーム": { "BIGLOBE光": 0.84, … } }
}
```
- 商材の列順は point_master.sort_order。Kintone の表記は kintone_names で束ねる（AU光 = 2 表記の合計）
- **数値は Excel と同じ丸めなし**（表示で丸める）

### 3-2. 答え合わせのテスト（最重要）

C:\garden\a-bloom-008\src\app\system\kanri\_lib\calc\kanri-sheet.golden.test.ts

- 入力：fixtures の 入力_Kintone.json／クレジットカード.json（生データシート＝Kintone の書き出しそのもの。2 行目が見出し、3 行目からデータ）、付与ポイント.json、入力_管理表.json の **手入力セル**（I8:I38・AF8:AF38・BC8:BC38 の h、L2:AD2・AI2:BA2・BF2:BX2 の開通率）、定休日＝B 列が「定休日」の日
- 期待値：入力_管理表.json の **計算セル**（E4:G6、K4:AD6 ほか各チーム、E8:G38、K8:AD38 ほか各チーム）
- **全セル一致**（数値は 1e-6、#DIV/0! は null、空は 0 または null のどちらかに揃える）
- fixtures の場所は環境変数 KANRI_FIXTURES_DIR で渡す。無ければテストを skip（個人名を含むので**リポジトリに入れない**）
- 一致しないセルは **セル番地・期待値・実際の値を全部出す**（Claude が差分を読む）

### 3-3. 画面（/system/kanri に足す）

```
　┌ 稼働時間と開通率（手入力） ─────────────────────────────┐
　│  対象月 2026年9月                                              │
　│  日      宮永チーム h   小泉チーム h   石原チーム h                  │
　│  9/1(火)  [ 61   ]      [ 50   ]      [ 34   ]                   │
　│  9/2(水)  [      ]      [      ]      [      ]                   │
　│  …                                                              │
　│  開通率   BIGLOBE光 Docomo光 AU光 …   ← チームごとに1行             │
　│  宮永     [0.84]    [0.89]   [0.7] …                              │
　│  [ 保存 ]                                                        │
　└──────────────────────────────────────────────┘

　┌ 管理表（計算結果） ────────────────────────────────────┐
　│  [ 計算する ]  最新の取り込み 9/2 21:32 をもとに計算します           │
　│  （Excel の【入力】管理表と同じ並びの表。横に長いので横スクロール。      │
　│  　見出し行と左の日付列を固定）                                     │
　└──────────────────────────────────────────────┘
```

- 手入力の保存先：system_kanri_month_setting に列を足せないので（SQL 禁止）、**同じ表の holidays と同様に扱える JSON 列が無い**。→ 今回は **system_kanri_result に sheet='inputs' として保存**する（run_id は最新の run。月が同じなら引き継ぐ）
- 「計算する」＝最新の run の生データ＋手入力＋設定で計算 → system_kanri_result（sheet='kanri'）に保存 → 表で表示
- 表の値は表示で丸める（時間は小数1桁、率は %、金額は 3 桁区切り）。null は「—」

### 3-4. API

- GET/PUT /api/system/kanri/inputs/[yearMonth] … 手入力の読み書き（manager 以上）
- POST /api/system/kanri/runs/[id]/calculate … 計算して保存（manager 以上）。戻りは grid
- GET /api/system/kanri/runs/[id]/result?sheet=kanri … 保存した grid

## 4. 変えてはいけないもの

- 段階1 の取り込み（Codex-286）と 4 つの注意
- Kintone 取得部品 C:\garden\a-bloom-008\src\lib\kintone\records.ts（GET に Content-Type を付けない）
- 入社手続き・交通費・銀行検索・世帯主
- C:\garden\a-bloom-008\src\app\_components\AppHeader.tsx と そのテスト。**一切触らないこと**
- **SQL を書かない**（移行は用意ずみ・中身も変えない）。本番のデータ・Storage・ドライブ
- fixtures と Excel は**読むだけ**

## 5. 決まりごと

- 絵文字を使わない。画面に開発者用語を出さない（grid／run／fixture を画面に出さない）
- 計算部品は純粋関数（同じ入力なら同じ出力）。DB 読み書きは別ファイル
- 商材・チームを**コードに直書きしない**（設定表から読む）

## 6. 受け入れ基準

1. npx vitest run src/app/system/kanri src/app/api/system/kanri が通る（合否行を必ず読むこと）
2. npx tsc --noEmit に今回の変更由来のエラーが無い
3. **KANRI_FIXTURES_DIR を指定した golden テストで、【入力】管理表の計算セルが 8/31 の値と全セル一致する**（BE5 の +0.4 だけは既知差分として除外し、8 章に記録）
4. 商材の列順・束ね方（AU光 2 表記）が設定表から来ている
5. 定休日の行が h=0・合計 0・稼働効率 null
6. 手入力（h・開通率）を保存して読み直せる
7. 「計算する」で結果が保存され、表で見える。横スクロールで見出し行と日付列が固定
8. API が manager 未満を 403 で断る
9. 絵文字を使っていない
10. 変更した TS/TSX の ESLint が通る
11. テストを追加してある（golden／定休日／束ね／権限／手入力の保存）

**実画面での確認は Claude が行う。本番DB には触らない。SQL も書かない。**

## 7. 完了報告（コードブロックで出力）

- 「未コミット」と明記
- 変更・追加したファイルのフルパス
- 受け入れ基準 1〜11 の結果（3 は「一致 ○○セル／不一致 ○○セル」と、不一致があればセル番地・期待値・実際値）
- 本番DB・Storage・ドライブに触っていないことの明記

## 8. 既知の差分（Codex が追記する）

- BE5 = SUM(BF5:BX5)+0.4（石原チームのポイントに手打ち補正）→ Garden は補正しない
- **Claude の検査で追加（2026-09-04）**：Codex の golden テストは係数・単価を Excel の答えから逆算していたため、次の 2 点が隠れていた（付与ポイント表の値だけで比べると不一致 12 セル）
  - Sofbank光 の金額欄（S6／AP6／BM6）に Excel は式が無い → Excel の合計金額に Sofbank光 が入っていない（8月：1+3+5 件 × 0.8 × 30,000 = 216,000 円）。Garden は設定表どおり計算する
  - 石原チームの ACマスター 金額（BT6）の式が `付与ポイント!R5`（ドコモでんき 16,000）を参照している（正しくは Q5 = 25,000）。Excel の 1 列ズレ。Garden は 25,000 で計算（差 4,500 円）
  - 上の 2 点の影響で E6／G6／I6／K6／AF6／AH6／BC6／BE6（金額の合計と時間あたり金額）も Excel とずれる
  - BE5 の +0.4 を除外した結果、BD5／F5／G5 も比較対象外になっている（Codex 報告に記載なし）
  - 管理表には NURO光（7万CB）の列が無い（19 商材）が、設定表には 20 商材ある → Garden は 20 列で出る（8月は件数 0）
- **Codex-287b 後の扱い（2026-09-04）**：golden テストは係数・単価を付与ポイント表だけから取り、Sofbank光 の金額（S6／AP6／BM6）と 石原 ACマスター（BT6）は期待値側で補正、それに連なる K6／AH6／BE6／G6／I6／AF6／BC6／E6 も再計算して全セル一致。除外は BE5／BD5／F5／G5 の 4 セルのみ。テスト側の kintone 表記には DB 初期値に無い「ライフカードビジネスライト」「さすがネット」も含む（8/31 データには出現しない。将来 Kintone にこの表記が出たら DB の kintone_names に足す）

