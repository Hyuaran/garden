# Codex-523 作業報告（2026-11-12）

## 実装した内容

`/bud/profit/broadband` の末尾に「Ichi光事業」タブを追加しました。ユーザー・獲得、請求・入金、原価・利益、要確認リストをGardenの画面で描きます。顧客番号は顧客一覧へのリンクです。事業の収支と同じ `broadbandAccess` を初期表示・手動更新の両方で確認し、歯車の閲覧権限がIchi光事業も含むことを明記しました。

サーバーで報告を読んでから初期表示します。通常は最後の確認から10分たった時だけ最新READY配備のIDを確認し、同じIDならファイルを読み直しません。配備が変わった時だけファイル一覧とbase64のHTMLを読みます。`const D` はscript内で1か所だけを認め、JSONとして解析します。取得内容のコードを実行する処理はありません。未知の項目は参照せず、不足する数値は「-」にします。

取得失敗時は最後に保存した内容を残し、前回日時と失敗の通知を表示します。確認日時と成功した読込日時は分離しています。失敗通知は次の確認まで残ります。同一プロセス内の同時取得をまとめ、保存分がまだ無い時の失敗も同一プロセス内では10分間抑制します。↻は10分制限を待たず配備を確認します。

## 変更・追加ファイル

- `src/lib/bud/ichi-report/model.ts`：取り出し、形の確認、計算、日付、原価未取り込みの判定。
- `src/lib/bud/ichi-report/snapshot.ts`：注入可能な取得・保存処理、10分制限、同じ配備の省略、失敗時の前回分。
- `src/lib/bud/ichi-report/read.server.ts`：サーバー専用の保存表との接続、環境変数、同時取得の集約。
- `src/lib/bud/ichi-report/report.test.ts`：取り出し、月別の計算、問い合わせ省略、取得失敗、保存失敗等。
- `src/lib/bud/ichi-report/__fixtures__/report.html`：元HTMLからJSONと純粋な利益計算式だけを抜き出した見本。レコード番号・顧客番号を架空の値に変更し、リンク先も例示用に変更。
- `src/lib/bud/ichi-report/__fixtures__/expected.json`：元の式に基づく月別の計算期待値。
- `src/app/bud/profit/broadband/page.tsx`：権限確認後、既存の収支と同時に初期報告を取得。
- `src/app/bud/profit/broadband/BroadbandTable.tsx`：新タブ、表示切り替え、閲覧権限の説明。
- `src/app/bud/profit/broadband/BroadbandTable.test.tsx`：タブの追加とサーバー処理のモック。
- `src/app/bud/profit/broadband/IchiReport.tsx`：4つのまとまり、札、各表、集計中、更新表示・再読込。
- `src/app/bud/profit/broadband/IchiChart.tsx`：既存と同じChart.js／react-chartjs-2、共通の色変数、明暗追従、固定の描画領域。
- `src/app/bud/profit/broadband/ichi-report.module.css`：表・札・グラフ・狭い幅の配置。
- `src/app/bud/profit/broadband/ichi-actions.ts`：権限を再確認する手動更新。
- `src/app/bud/profit/broadband/loading.tsx`：共通の表の読み込み表示。
- `src/app/bud/profit/broadband/IchiReport.test.tsx`：サーバー初期描画、集計中、リンク、失敗通知、再読込、形の変更。
- `src/app/bud/profit/broadband/ichi-access.test.tsx`：権限が無い人には初期データも手動更新も渡さない。
- `src/app/system/_components/UpdatedStamp/UpdatedStamp.tsx`：既存の表示を維持しつつ「後道さんの更新：」を指定できる任意項目を追加。
- `supabase/migrations/20261112000523_bud_ichi_report_snapshot.sql`：保存表。RLS有効、公開・未ログイン・ログイン利用者から権限を剥奪、service_roleだけ読み書き可。**作成のみ、未適用**。
- `docs/dispatches/dispatch-codex-523-bud-ichi-hikari-tab-20261112.md`：取り直し回数の見積もりを追記。
- この報告書。

## マニュアル

指定のSystemのマニュアル置き場には対象が無かったため、Budの以下の既存資料を更新しました。④を先に更新し、⓪の埋め込み④も同期しました。版はv1.4、日付は2026-11-12。追加分は未適用・未公開と明記しています。Storageへは上げていません。

場所：`C:\Claude\000_Garden\070_Bud_経理収支\00_マニュアル\08_損益管理\`

- `Garden_Bud_事業の収支_4_仕様書_Claude読み込み用.md`
- `Garden_Bud_事業の収支_0_要点サマリ.html`
- `Garden_Bud_事業の収支_1_操作マニュアル_研修用.html`
- `Garden_Bud_事業の収支_2_仕様書マニュアル_非エンジニア向け.html`
- `Garden_Bud_事業の収支_3_仕様書マニュアル_エンジニア向け.html`

## テスト結果

- `npx tsc --noEmit`：成功。
- `npx vitest run src/lib/bud src/app/bud/profit src/lib/ui`：24ファイル・116件成功。
- 元の見本の全請求月で、売上・原価・費用・粗利・営業利益・入金ベース利益・未納・入金率・1人あたりを照合。
- 正常JSON、script外の定義、定義なし、重複定義、不正JSON、未知の形、10分以内、同じ配備、新しい配備、接続障害、鍵なし、保存失敗、権限、タブ追加、集計中を確認。
- 初期描画はサーバー描画テストで4つのまとまり・日時・集計中・顧客リンクが最初から含まれることを確認。グラフ領域の高さを予約し、描画アニメーションを無効化。

## 元HTMLとの違い・未検証事項

- 元の独自SVGやHTMLの埋め込みは使わず、Gardenの表とChart.jsで再構成。獲得のグラフは受注・開通・解約の棒で示し、受注の現在の状態とキャンセル①〜③は表に掲載。元の独自の吹き出し・画面内タブ・保存版切り替えは移植していません。
- 利益等の計算式は維持。未確定の入金・費用・営業利益は「集計中」。原価や決済費が前月にはあり当月ゼロの時は、元と同様「未取り込み？」を表示。
- ブラウザ・computer-useは禁止のため使っていません。実ブラウザでの明暗・各画面幅・描画後のちらつきの目視検証は未実施です。マニュアルもHTMLの構造確認のみです。
- Vercel・Kintoneは全てモックで検証。実際の応答との接続確認は未実施。migration適用、環境変数の設定、公開は担当者側の作業です。

## 取り直し回数・実施しなかった操作

定時処理・ポーリング追加は0回/日。連続利用時の通常の配備確認は共有保存分あたり約144回/日、同じ配備なら1回の通信、変わった場合のみ2回追加（毎回変わるなら約432リクエスト/日）。手動更新は別に1操作1〜3回。画面を開かない間は0回。複数プロセスの同時確認や未保存状態での障害時は目安を超える可能性があります。

git操作、コミット、ブラウザ操作、本番書き込み、migration適用、Vercel/Kintoneの実呼び出し、Storageアップロード、`vercel.json`の変更は行っていません。
