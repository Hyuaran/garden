# Codex-528 管理表ポータルのポイントを「付与ポイント表」から取る（2026-11-12）

作業場所：`C:\garden\a-bloom-008`（main）

**git は触らない（commit もしない）。computer-use・ブラウザ操作は使わない。本番に書き込まない（migration が要るならファイルを作るだけ。当てるのは Claude）。Kintone・KING OF TIME・Chatwork を本当に呼ばない。** ファイルは UTF-8。文字化け（??）を残さない。必要な範囲だけ読む。画面の文字はきちんとした日本語。コードは周りと同じく読みやすく書く。

## ねらい

管理表ポータル（`/system/kanri`）は今、旧表 `system_kanri_point_master`（20 商材・期間なし・獲得方法なし）でポイントと単価を数えている。これを Soil の **付与ポイント表 `soil_product_points`**（27 商材 × 白地／LP／アライアンス × 期間）に切り替える。配信（コール集計の【テレマ全体】P）と同じ表・同じ決め方にそろえる。

東海林さんの決定（2026-11-12）：

1. **2026年10月以前の月は旧表のまま**（今の計算・列・Excel を1つも変えない。golden テストはそのまま通る）。**2026年11月以降の月は付与ポイント表**。付与ポイント表は 2026-11-01 からの行しかない
2. 11月以降の管理表の商材の列は、**付与ポイント表の商材（その月に有効な行の商材・`sort_order` 順・同じ商材は1列）**。名前も付与ポイント表のまま（例：JCB → JCB Biz ONE、NL → 三井住友カード（NL））。今は 27 商材
3. 1件ごとに、**商材 × 獲得方法 × 日付**で付与ポイント表の行を当てる（同じ商材でも獲得方法・期間で値が違ってよい作りにする。今は3つ同じ値）
4. 付与ポイント表に無い商材（例：NURO光（7万CB）、タイプの無い「au光プラス」）は数えず、取り込みの警告に「ポイント表に無い商材：〇〇 n件」と出す（配信と同じ）

## 読むもの

- 付与ポイント表の共通部品：`src/lib/product-points/index.ts`（`resolveChannel`・`pointFor`・`Order`・`PointRow`）、読み込み `src/app/soil/product-points/server.ts`（`loadPoints`）
- 配信での使い方（**ここと同じ決め方にする**）：`src/app/system/_lib/call-report-v3.ts`（顧客一覧・クレカの獲得方法・商材名・日付・「商材区分2（マスタ）」で探す）、`call-report-v3.server.ts`
- 管理表：`src/app/api/system/kanri/runs/[id]/calculate/route.ts`、`src/app/api/system/kanri/runs/[id]/excel/route.ts`、`src/app/system/kanri/page.tsx`、`src/app/system/kanri/_lib/calc/kanri-sheet.ts`（`KANRI_TEAM_BLOCKS`・`countSourceProducts`・`calculateKanriSheet`）、`_lib/calc/jisseki-sheet.ts`（`productKind`・`productColumns`）、`_lib/export/excel-export.ts`（`writePointMaster`・チームの列）
- テスト：`kanri-sheet.golden.test.ts`・`jisseki-sheet.golden.test.ts`・`excel-export.test.ts`（8月の答え合わせ。**変えない・通ること**）

## 1. ポイント表の読み分け（月で切り替え）

- 計算・Excel・画面の3か所が同じ関数で読むようにする（例：`loadKanriPoints(yearMonth)` を `_lib` に）
- その月の1日が 2026-11-01 より前 → 旧表をそのまま返す（今と同じ形）
- 2026-11-01 以降 → 付与ポイント表のその月に有効な行（期間が月と重なる行）を返す
- 付与ポイント表の `category` の読み替え：`kaisen` → 光回線（実績管理のトス／AP の2列）、`credit` → クレカ、`denki` → 電気

## 2. 数え方（11月以降）

- 今は「商材ごとの件数 × 商材の係数」。11月以降は **1件ごとに `pointFor` で行を当て、その行の `total_points` と `unit_price` を足す**（列は商材ごと。件数・ポイント・金額の合計の形は今と同じ）
- 獲得方法・日付・商材名の決め方は `call-report-v3.ts` と同じにする（関数を共通にできるなら共通にする）
- 実績管理シートの光回線：トス＝`toss_points`、AP＝`closer_points`（今の「AP は係数−0.2、トスは 0.2」と同じ結果になる）。クレカ・電気は今どおり1列で `total_points`

## 3. 列の並び（11月以降・商材が 20 を超える）

今の `KANRI_TEAM_BLOCKS` はチームごとに商材 20 列（L〜AE／AI〜BB／BF〜BY）で、27 商材だと隣のチームにはみ出す。

- **10月以前は今の固定の列のまま**
- **11月以降は商材の数からチームの列の場所を計算する**（稼働h・効率・合計の3列＋商材 N 列で1チーム）。画面の表と Excel の両方
- Excel の見た目（見出しの色・罫線・幅・シート順）は今と同じ形で広げる。ひな形の見出し（`template-labels.json`）で商材名やチーム名が固定の位置に書いてあるところは、計算した位置に書く
- 「付与ポイント」シートも 27 商材を並べる（商材・ポイント・単価）。11月以降は、白地の行の値を出し、獲得方法で値が違う商材があれば行を分ける（今は無い）

画面の絵（11月以降・1チームぶん）：

```
| 稼働h | 効率 | 合計 | BIGLOBE光 | Docomo光 | AU光 | … | プライム電気(JAPAN電力) |   ← 商材 27 列
```

## 4. 警告

付与ポイント表に無い商材の件数を、計算の警告に「ポイント表に無い商材：〇〇 n件」と出す（今の警告の出し方に合わせる）。10月以前は出さない（今と同じ）。

## マニュアル

`C:\Claude\000_Garden\150_System_システム\00_マニュアル\07_管理表ポータル\` の ⓪〜④：11月分から付与ポイント表（Soil「付与ポイント表」の画面）の値で数えること、10月以前は今までの値のままであること、表に無い商材は警告に出ることを書く。`34_付与ポイント表` の ⓪〜④ には「管理表ポータルもこの表を使う（2026年11月分から）」を足す。版は次・日付 2026-11-12。④を先に。**Storage へは上げない**。

## テスト

- 10月以前：golden（8月）が変わらず通る（**テストの答えを書き換えない**）
- 11月以降：27 商材の列・チームの列の場所がずれない・1件ごとの当て方（獲得方法・期間で違う値を入れたテスト用の行で確かめる）・トス／AP の分け方・表に無い商材の警告・Excel の「付与ポイント」シート
- `npx tsc --noEmit`、`npx vitest run src/app/system/kanri src/app/api/system/kanri src/lib/product-points src/app/system/_lib` が通ること（前から落ちているテストは報告に書く）

## 終わったら

`docs/dispatches/report-codex-528-kanri-points-from-soil-20261112.md` に、直したファイル・10月以前と11月以降の分け方・列の場所の決め方・テスト結果・作れなかったもの・迷って決めたことを書く。
