# Codex-536 実績日・実績可否とテレマ配信の実装報告（2026-11-20）

## 変更ファイル

- `public/kintone/garden-jisseki-rules.js` — 顧客一覧（アプリ10）の実績日・実績可否を自動更新。PC・スマホの作成・編集とPCの一覧行内編集で、対象項目の変更時と保存直前に適用する。
- `public/kintone/garden-jisseki-rules.test.ts` — 初期値、既存値の保持、リトライと立ち上げの前後・同日、キャンセル、管理会社まちの優先順位を検証。
- `src/app/system/_lib/call-report-v3.server.ts` — 顧客一覧を実績日と実績可否「可」で取得する。
- `src/app/system/_lib/call-report-v3.ts` — 取得後も実績日と実績可否を確認し、立ち上げ案件は末尾の「立ち上げ」行に獲得方法・商材グループ別のポイントを表示する。合計件数のポイントに立ち上げ分を含める。商材ステータスによるキャンセル除外とクレカの集計条件を維持した。
- `src/app/system/_lib/call-report-v3.test.ts`、`src/app/system/_lib/call-report-v3.server.test.ts` — 実績日・実績可否のフィクスチャ、当日受注と立ち上げの混在、「否」や空欄の除外、Kintone の取得条件を検証。

## ローカル検証

- `npx vitest run public/kintone src/app/system/_lib` — 20ファイル、151テスト成功。
- `npx tsc --noEmit` — 最終実行は終了コード0。初回は並行作業中の `scripts/leaf-kanden-photos/import-timetree.ts` に TS7034・TS7005 が出た。対象外ファイルへの編集は行っていない。

## 受注日で数えている所と関連する利用箇所

| 箇所 | 受注日の用途 |
| --- | --- |
| LP・WEBインバウンドの顧客一覧受注数（`src/app/system/_lib/lp-kintone.ts`、`call-metrics-merge.ts`、`call-report.ts`） | WEBリストのアプリ10の記録を受注日の範囲で取得し、事業別の受注数を集計する。配信のWEBインバウンド欄の「受注数」にも使う。 |
| 管理表ポータルの付与ポイント（`src/app/system/kanri/_lib/soil-points.ts`） | 月の対象は実績日で絞る。ポイント表の適用期間は受注日を先に参照し、該当行がなければ実績日で照合する。 |
| Soil 顧客リスト・受注履歴（`src/app/api/soil/list/orders/_lib/order-sync.ts`、`src/app/api/soil/list/_lib/history-sql.ts`、`raw-excel/raw-excel.server.ts`、`fm-import.ts`） | 受注日の取り込み、履歴・照合結果の日付、最新履歴の選択に使う。最新受注日・商材の選択、購入日以降の受注判定、エクスポート時の最新受注選択でも受注日を使う。関連マイグレーションは `20260911000001`、`20260916000001`、`20260917000006`、`20260917000007`。 |

## 気になった点

- Kintone の設定作業では「管理会社まち」の選択肢追加と、PC用・スマートフォン用のJavaScript URL登録が必要。画面イベントで動くため、保存済みのレコードやAPI経由の更新には自動適用されない。実績日・実績可否が空欄の既存案件は、新しいテレマ集計の対象外になる。
- 一覧行内編集などで判定に必要な項目がイベントに含まれない場合は更新をスキップする。実機での項目アクセスとイベント動作は未確認。
- 配信のポイント表の適用期間は集計対象日の実績日で照合する。管理表の既存の照合順とは独立している。
- Vercel の呼び出し増分は **0回/日**。既存の配信cronは設定上 **11回/日**（JST 11:05〜21:05、1時間ごと）。顧客一覧取得の条件を変更した。
