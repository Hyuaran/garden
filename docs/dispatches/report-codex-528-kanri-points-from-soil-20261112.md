# Codex-528 完了報告（2026-11-12）

## 実装

- `src/app/system/kanri/_lib/kanri-points.server.ts`：計算・Excel・画面共通の読み込み。
- `src/app/system/kanri/_lib/soil-points.ts`：月内の商材一覧、配信と共通の受注抽出、行照合、未登録商材の警告。
- `src/app/system/kanri/_lib/calc/kanri-sheet.ts`：各件のポイント・単価の集計、可変のチーム列、警告の保存。
- `src/app/system/kanri/_lib/calc/jisseki-sheet.ts`：各件のトス／APポイント、クレカ・電気の合計ポイント。
- `src/app/system/kanri/_lib/export/excel-export.ts`：管理表のひな形の列移動、実績の商材見出し、付与ポイント27商材と差分行。
- `src/app/api/system/kanri/runs/[id]/calculate/route.ts`：共通読み込みと警告の応答。
- `src/app/api/system/kanri/runs/[id]/excel/route.ts`：取り込み対象月のポイント表を読み込み。
- `src/app/system/kanri/page.tsx`：表示対象月の商材を共通読み込み。
- `src/app/api/system/kanri/month-settings/[yearMonth]/route.ts`、`src/app/system/kanri/KanriPortalClient.tsx`：対象月切り替え時に入力用商材も更新。計算結果の警告を表示。
- テスト：`src/app/system/kanri/_lib/soil-points.test.ts` を追加、月設定の `route.test.ts` に月別商材読み込み確認を追加。

## 月・列・集計の決め方

2026年10月以前は旧 `system_kanri_point_master` を読み、従来の集計と固定列を使用する。既存goldenテストの答え・コードは変更していない。

2026年11月以降は、その月と期間が重なる `soil_product_points` の行を読む。sort_order順、同じ商材は1列。categoryは光回線・クレカ・電気に読み替える。各商材に全獲得方法・期間の行を保持する。

受注の抽出には配信の `reportOrders` 自体を利用する。顧客一覧は受注日、クレカは日付_4／紹介日、事業名・リスト名から獲得方法を判定する。キャンセル除外・クレカ旧データの白地補完も配信と同じ。`pointFor` で照合し、見つからない場合だけm_productで補完する。

管理表は各件のtotal_pointsとunit_priceを合算する。金額は従来の形に合わせ、単価合計に商材別の開通率を掛ける。定休日・対象日以降の除外も維持する。実績管理は光回線をtoss_points／closer_points、それ以外をtotal_pointsで集計する。

11月以降のチームはI列から「3＋商材数」列ずつ配置する。27商材なら稼働hの列はI／AM／BQ、商材列はL〜AL／AP〜BP／BT〜CT。画面はgrid.productsを各チームに展開する既存構造を使用。Excelは同じ計算でセル・見出し・幅を移動し、罫線とシート順を維持する。

付与ポイントシートは白地の値を上段に表示する。ポイント・単価が白地と異なる行は下段に商材・獲得方法・期間・ポイント・単価を分けて表示する。

未登録商材は集計しない。「ポイント表に無い商材：〇〇 n件」を計算結果gridにも保存し、再表示時も見えるようにした。10月以前には追加しない。

## テスト

- `npx tsc --noEmit`：成功（終了コード0）。
- `npx vitest run src/app/system/kanri src/app/api/system/kanri src/lib/product-points src/app/system/_lib`：成功。46ファイル成功、6ファイルスキップ。242件成功、8件スキップ、失敗0。
- 追加確認：27商材、チーム境界、獲得方法・月途中の期間で異なるポイントと単価、トス／AP、未登録警告、マスタ補完、キャンセル除外、クレカ旧フィールド、Excelの見出し・付与ポイント・xlsx生成、月切り替えの商材読み込み。
- 既存goldenはfixture未指定のためスキップ。8月実データの一致を実行して確認したとは言えない。既存の答えは変更していない。既存テストの失敗はなかった。
- ログ：`codex-528-vitest.log`、`codex-528-tsc.log`。ブラウザでの確認は実施していない（指示どおり）。

## マニュアルと未反映事項

指定先 `C:\Claude\000_Garden\150_System_システム\00_マニュアル` はこのセッションの書き込み許可範囲外。承認も取得できない環境のため、原本は変更していない。

代わりに `docs/dispatches/codex-528-manuals/` に、07_管理表ポータル・34_付与ポイント表それぞれ⓪〜④、計10ファイルの更新版を作成した。④を先に更新し、各HTMLに変更節を追加。管理表はv2.3、付与ポイント表はv1.3、日付は2026-11-12。管理表⓪の内蔵④も更新した。原本へのコピーは人間側で必要。

golden実行には `KANRI_FIXTURES_DIR` の設定が必要。migrationは不要。定期実行・取り直しの追加は1日0回。git操作、ブラウザ操作、本番書き込み、Kintone・KING OF TIME・Chatworkの実呼び出し、Storageへのアップロードは行っていない。
