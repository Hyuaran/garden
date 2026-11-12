# Codex-528b 完了報告（2026-11-12）

## 修正したファイル

- `src/app/system/kanri/_lib/soil-points.ts`：管理表の月・日の振り分けを顧客一覧の実績日へ変更。ポイント照合用の受注日（空なら実績日）は別に保持。獲得方法不明は白地に補完し、事業名別の警告を作る。
- `src/app/system/kanri/_lib/calc/kanri-sheet.ts`：日別件数・定休日・対象日以降の除外に実績日を使用。獲得方法不明の警告をgridに保存。
- `src/app/system/_lib/call-report-v3.ts`：獲得方法・商材名・キャンセル除外の共通抽出を切り出し。配信の当日抽出と不明な獲得方法の除外は維持。獲得方法の小計が0の行を非表示にし、合計行は常に表示。
- `src/app/system/kanri/_lib/soil-points.test.ts`：実績日での月境界・日別列、受注日での期間照合、照合対象なし、受注日空欄、定休日・対象日除外、実績管理への反映、不明な事業名の白地集計と警告を検証。
- `src/app/system/_lib/call-report-v3.test.ts`：白地だけの日と全件0の日の本文期待値を修正・追加。
- `src/app/system/_lib/__snapshots__/call-report-v3.server.test.ts.snap`：アライアンス0.0P行の削除を反映。

## テスト結果

- `npx tsc --noEmit`：成功、終了コード0。
- `npx vitest run src/app/system/kanri src/app/api/system/kanri src/lib/product-points src/app/system/_lib`：成功、終了コード0。46ファイル成功・6ファイルスキップ、244件成功・8件スキップ。
- 配信本文のスナップショット更新後のテスト：4件成功。
- ログ：`codex-528b-tsc.log`、`codex-528b-vitest.log`、`codex-528b-snapshot.log`。
- 10月以前の計算分岐・goldenの期待値は変更していない。goldenは `KANRI_FIXTURES_DIR` 未設定のためスキップであり、実データとの一致を実行確認したものではない。

## 判断したこと

- `reportOrders` の当日絞り込みを管理表には使わず、共通抽出関数のみ使用する。配信では従来どおり獲得方法不明の受注を除外する。
- 実績管理は既存の `matchedKanriOrders` 経由で修正が反映されるため、`jisseki-sheet.ts` 自体の変更は不要。
- 受注日の期間に対応するポイント行が読み込み済みの表に無い場合は、指示どおり「ポイント表に無い商材」の警告とする。
- 獲得方法不明の警告は月内のキャンセルを除いた受注に対して作成し、未登録商材の警告と併記できるようにした。
- 定期実行・取り直しの追加はなし（1日0回）。マニュアル変更なし。

git操作、computer-use、ブラウザ操作、本番書き込み、Kintone・Chatworkの実呼び出しは行っていない。
