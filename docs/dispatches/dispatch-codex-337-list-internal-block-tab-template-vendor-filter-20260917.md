# Codex-337 リストマスタ：「自社アポ禁」タブの新設（管理方法タブから移動）＋一括インポート用テンプレートの DL ＋ リストタブに「購入先で絞る」を追加

作成日: 2026-09-17
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認）
**git は触らないこと（commit するな）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。migration は `supabase/migrations/20260917000008_soil_list_vendor_option.sql` の 1 本だけ書き、実行しない（実行は Claude）。Codex-338 が同時に `src/app/api/soil/list/analysis/` を編集中 → そこは読みも書きもしない。**

必ず先に読むもの：
- ④：C:\Claude\000_Garden\150_System_システム\00_マニュアル\14_リストマスタ\Garden_System_リストマスタ_4_仕様書_Claude読み込み用.md（§2 画面構成・§2-4 管理方法・§4-1 条件と検索・§8-9 の Codex-311（絞り込みの複数選択）・331（自社アポ禁）・332（解除モーダル））
- 画面：C:\garden\a-bloom-008\src\app\system\list\_components\ListMasterClient.tsx（タブの並び・管理方法タブの「自社アポ禁」セクション・リストタブの絞り込み 14 項目と `FilterState`・`MultiSelectFilter`）・`MultiSelectFilter.tsx`・`list-master.module.css`
- 絞り込みの選択肢：`public.soil_list_option`（`soil_list_refresh_options()` が台帳から列ごとに値と件数を作る。`supabase/migrations/20260915000001_…sql`）・API `src/app/api/soil/list/options/`（あれば）・条件→SQL `src/app/api/soil/list/_lib/search-sql.ts`・`query.ts`・`validation.ts`（`SoilListFilterField`）・`src/app/system/list/_lib/list-fields.ts`
- 自社アポ禁の API：`src/app/api/soil/list/internal-block/`（1 件・preview・bulk・PATCH）と `_lib/internal-block-parser.ts`（列＝電話番号・理由）
- テンプレートの作り方の先例：`src/app/api/soil/list/uploads/template/route.ts`（Codex-314・exceljs・記入例＋書き方シート）

## 0. 何を直すか（東海林さん 2026-09-17）

1. **自社アポ禁を独立したタブに**：今は管理方法タブの中にある「自社アポ禁」（1 件登録・ファイル一括・登録済み一覧・解除）を、**新しいタブ「自社アポ禁」**へ丸ごと移す。管理方法タブは説明だけに戻す（自社アポ禁の説明の行は残し、「登録・解除は自社アポ禁タブで」と書く）
2. **一括インポート用のテンプレート**：自社アポ禁タブのファイル一括のところに［テンプレートをダウンロード］（Excel・列＝電話番号・理由・1 行目見出し・2 行目記入例・書き方シート：電話番号はハイフンあり／なしどちらでも可・理由は必須・1 行 1 番号・既に登録済みの番号は件数に出て足されない）
3. **リストタブに「購入先で絞る」**：いま絞り込み 14 項目に購入先が無い。台帳の **最新購入先** で絞れるようにする（複数選択＝いずれか）

```
タブ：リスト｜アップロード｜分析｜履歴検索｜自社アポ禁｜管理方法
```

## 1. 自社アポ禁タブ

```
┌ 自社アポ禁（ヒュアラン社内だけの架電禁止。購入元のアポ禁とは別）────────────────┐
│ 1 件登録：電話番号 [__________]  理由 [________________________]  [ 登録 ]           │
│ ファイルで一括：[ CSV／Excel をここに ]  [ テンプレートをダウンロード ]                  │
│   → 中身の確認（n 件・重複 n・登録済み n・番号の形が違う n）→ [ 登録する ]              │
│ 登録済み一覧（新しい順・100 件ずつ・番号で探す・解除済みも見る）                          │
│   電話番号 ｜ 登録日 ｜ 理由 ｜ 登録者 ｜ 出所 ｜ [解除]（Codex-332 のモーダル）           │
└──────────────────────────────────────────────────────────────────────┘
```

- 中身・API・状態管理は今のものを**そのまま移動**（動きを変えない）。URL は `?tab=internal-block`。タブの並びは上の図（履歴検索の右・管理方法の左）
- テンプレート：`GET /api/soil/list/internal-block/template`（manager 以上）→ `自社アポ禁_一括登録テンプレート.xlsx`。列名は `internal-block-parser.ts` が読む見出しと**同じ文字**にする
- 管理方法タブ：自社アポ禁のセクション（入力・一覧）を外し、説明表の行に「登録・解除は「自社アポ禁」タブ」

## 2. リストタブ「購入先で絞る」

- `FilterState` に `purchaseVendor: string[]`。絞り込みの並びは「購入状態」の隣。部品は `MultiSelectFilter`（都道府県と同じ複数選択・検索欄あり）。選択肢は **台帳の最新購入先の値と件数**（購入先は約 2,400 種類あるので、選択肢は件数の多い順・検索欄で絞る。分析タブの `vendorFilterGroups` の作り方を参考に、上位とその他をグループ分けしてもよい）
- 選択肢の出どころ：`soil_list_refresh_options()` の対象列に **`最新購入先`** を足す（migration `20260917000008_soil_list_vendor_option.sql`＝関数の create or replace。空欄は「（購入先なし）」として選べる）。選択肢 API がその列を返すようにする
- 条件：`SoilListFilterField` に `latestVendor`（列＝`最新購入先`・op `in`／`inOrEmpty`）。`search-sql.ts`（DB 直結）と `query.ts`（REST・件数）の両方に対応。条件の要約（「購入先：Luna ほか 2」）・保存条件・書き出し（3 形式＋FileMaker 取込用）・分析タブの `soil_list_analysis_filtered` との違い（こちらは台帳の最新購入先だけ・「かつ」ではない）を管理方法タブの説明に 1 行
- 索引：`soil_list_phone("最新購入先")` に btree が無ければ migration に `create index if not exists … on public.soil_list_phone ("最新購入先")`（267 万行・作成に時間がかかる旨を完了報告に）

## 3. テスト（vitest・全部緑にしてから完了報告）
- タブ切替（`?tab=internal-block`）と管理方法タブから自社アポ禁の入力が消えていること
- テンプレート API が xlsx を返し見出しがパーサーの期待と一致
- `latestVendor` の条件が SQL（DB 直結）と REST の両方で効く／要約に出る／保存・読み込みで残る
- `npx tsc --noEmit`・`npx vitest run src/app/system/list src/app/api/soil/list`

## 4. 完了報告（コードブロックで）

```
Codex-337 完了報告
- 触ったファイル（新規／変更）
- migration の内容（refresh_options の列追加・索引）
- Claude が確認する手順（自社アポ禁タブ → テンプレ DL → リストタブで購入先を選んで検索 → 件数と一覧 → 書き出しの要約）
- 気になった点
```
