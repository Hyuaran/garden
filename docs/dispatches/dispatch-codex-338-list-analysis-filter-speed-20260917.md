# Codex-338 リストマスタ：分析①の絞り込み（購入先・元回線・契約時期）を即時に（毎朝の粒度表を使う）

作成日: 2026-09-17
作業ツリー: C:\garden\a-bloom-008
起点: main の最新（`git log -1` で確認）
**git は触らないこと（commit するな）。本番のデータ・DB に触らないこと。開発サーバ・ブラウザを起動しないこと。migration は supabase/migrations に書くだけで実行しない（実行は Claude）。**
**触ってよい範囲：`src/app/api/soil/list/analysis/` 配下・`supabase/migrations` の新規 1 本・それらのテストだけ。`src/app/system/list/_components/ListMasterClient.tsx` は読むだけ（Codex-337／314b が編集中）。API の応答の形は変えない（画面を直さずに速くする）。**

必ず先に読むもの：
- ④：C:\Claude\000_Garden\150_System_システム\00_マニュアル\14_リストマスタ\Garden_System_リストマスタ_4_仕様書_Claude読み込み用.md（§4-5 分析・§8-9 の Codex-335「落とし穴」）
- 今の絞り込み：`supabase/migrations/20260917000006_soil_list_purchase_repurchase.sql` の `soil_list_analysis_filtered`（DB 直結・267 万行を毎回集計＝6〜10 秒）と、同じ migration で作った **`soil_list_analysis_purchase_filter_cell`**（購入先×元回線×契約時期年×コール結果の粒度表・約 9,000 行・毎朝 `soil_list_analysis_finish` で作り直し・**今は未使用**）
- API：`src/app/api/soil/list/analysis/route.ts`（`loadFilteredAnalysis`）・`_lib/analysis.ts`

## 0. 何を直すか（東海林さん 2026-09-17）

分析①で購入先・元回線・契約時期を選ぶたびに 6〜10 秒待つ。粒度表を使えば**足し算だけ**で済む。

- **購入先が 0〜1 個**（元回線・契約時期は何個でも）：`soil_list_analysis_purchase_filter_cell` を絞って足し合わせる（Supabase REST・1,000 行の上限に注意して range で読む、または DB 直結の 1 本の SQL）。目標 0.5 秒以内
- **購入先が 2 個以上（かつ）**：粒度表では「すべてに購入履歴がある番号」を表せないので、今までどおり `soil_list_analysis_filtered`（DB 直結）。画面の注記どおり
- 切り口（購入先／元回線／契約時期）に応じて `segment` を粒度表の列から選ぶ。応答の形（block・segments・results・受注顧客数・受注案件数・獲得 等）は今と同じにする
- 粒度表には「受注顧客数（order_count）」「受注案件数（order_case_count）」「獲得（acquired_count）」「無効（invalid_count）」があるので、今の `AnalysisSegment` の計算に必要な項目が足りるか確認し、足りなければ粒度表の列を足す（migration＋`soil_list_analysis_finish` の insert 文を更新）。**list_name ごとの内訳（詳細）** が絞り込みでも必要なら、粒度表に `list_name` の次元を足すのではなく、詳細を開いたときだけ既存の DB 直結で取る
- 「集計：… 時点」の表示は粒度表の作成時刻（`soil_list_analysis_state.refreshed_at`）を使う。粒度表が空（初回・失敗）のときは今の DB 直結にフォールバック

## 1. テスト（vitest）
- 購入先 1 個＋元回線 2 個＋契約時期 1 個 の合算が正しい（粒度表のモック）
- 購入先 2 個は DB 直結の関数を呼ぶ
- 粒度表が空ならフォールバック
- 既存の分析テストを壊さない（`npx vitest run src/app/api/soil/list/analysis`・`npx tsc --noEmit`）

## 2. 完了報告（コードブロックで）

```
Codex-338 完了報告
- 触ったファイル
- 粒度表に足した列（あれば）と migration
- 想定の応答時間（粒度表の行数と読む行数）
- テスト結果
- Claude が確認する手順（分析①で 購入先 1 個／元回線／契約時期 を選んで秒数・数字が DB 直結と一致するか）
```
