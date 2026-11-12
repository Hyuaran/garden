# Codex-520 付与ポイント表 作業報告

日付：2026-11-12

## 実装したもの

- `/system/product-points`「付与ポイント表」を追加。責任者以上が閲覧し、追加・保存・期間切り替えは全権管理者だけに許可。
- 今日有効な期間を既定表示。獲得方法・区分の絞り込み、過去・予定期間の表示、行全体からの詳細小窓、楽観更新と失敗時の復元に対応。
- 共通の `SystemBreadcrumb`・`UpdatedStamp`・`DataTable`・`BoxSelect`・`Modal`・`form-kit` を使用。初期値はサーバーで取得し、取得後に描画。定期取得とcronの追加はなし（0回/日）。
- 「この日から新しいポイントにする」は既存期間の終了と新規期間の追加を一つのDB関数で実行。行ロックと更新時刻の比較で同時編集の上書きも防止。
- 商材の表記ゆれ、受注日、獲得方法でポイントを求める純粋関数と、獲得方法別・配信内訳別・表にない商材の集計を追加。
- Systemのホームメニューと閲覧・変更権限の台帳を登録。

## 作成・変更したファイル

新規：

- `supabase/migrations/20261112000520_soil_product_points.sql`
- `src/lib/product-points/index.ts`
- `src/lib/product-points/initial-values.json`（元シートと照合した27商材の検証用初期値）
- `src/lib/product-points/product-points.test.ts`
- `src/app/system/product-points/page.tsx`
- `src/app/system/product-points/ProductPointsClient.tsx`
- `src/app/system/product-points/product-points.module.css`
- `src/app/system/product-points/server.ts`
- `src/app/system/product-points/actions.ts`
- `src/app/system/product-points/ProductPointsClient.test.tsx`
- `src/app/system/product-points/server.test.ts`
- `src/app/system/product-points/actions.test.ts`
- `scripts/verify-product-points-520.mjs`
- 本報告書

既存ファイルの変更：

- `src/app/system/_components/ShachoShell/shacho-shell-config.ts`
- `src/lib/auth/permission-registry.ts`
- `src/lib/auth/system-view-scopes.ts`

## migration

ファイル作成のみ。本番には適用していない。

`soil_product_points` は生成列によるクローザーポイント、期間・ポイント・区分の制約、`btree_gist` の排他制約、責任者以上の閲覧RLSを持つ。表記ゆれを照合する `soil_product_point_at` は読み取り専用の `security invoker`。`soil_product_points_save` は `service_role` のみ実行可能な `security invoker`。

初期値は27商材×3獲得方法＝81行、開始日2026-11-01、終了日は空。`btree_gist` を使用できない環境では、このファイルをそのまま適用せず同等の重複拒否処理が必要。

## 元シートとの照合と判断

`C:\Users\shoji\Downloads\【管理表】実件数報告_20261111.xlsm` の「付与ポイント」をファイルから読み取って確認した。3行目の区分、4行目の商材、5行目のポイント、6行目の金額、7行目のオプション有無は、指示書の27商材とすべて一致。指示書の初期値からの変更なし。

旧台帳から `au光　Sonet`・`au光　BIGLOBE`・`au光`・`docomo光` 相当の大小文字・空白表記、`Sofbank光`・`さすガねっと`・`ライフカード`・`ACマスターカード` を引き継いだ。全角・半角空白の別名も登録し、照合でも正規化する。旧台帳の `NURO光（7万CB）` は今回の27商材に存在しない別条件の商材なので、NURO光の別名にはしない。タイプ不明の `au光プラス` も含めない。

テスト項目の「トス付与Pがクローザーを超えない」は本文の「クレカ・電気ガスはトス＝合計、クローザー＝0」と矛盾するため、本文と元シートを優先した。制約とテストは「トスは0以上、合計以下」「クローザー＝合計−トス」とした。

## テスト結果

- `npx tsc --noEmit`：成功。
- 指定の `npx vitest run src/lib/product-points src/app/system/product-points src/lib/auth/permission-registry.test.ts src/lib/auth/system-view-coverage.test.ts src/lib/ui/no-flicker-source.test.ts`：7ファイル・29テスト成功。
- 新規実装ファイルと検証スクリプトへのESLint：成功。
- 一時的なローカルPostgreSQL（PGlite）でmigration自体を実行：21項目成功。初期81行、終了日未指定の期間との重複拒否、日付・ポイント制約、表記ゆれ、開始日・終了日の境界、切り替えによる2行の返却、2行目の失敗時に1行目も戻ること、更新時刻の不一致、閲覧RLS、認証利用者からの書き込み・保存関数実行拒否を確認した。外部のDBには接続していない。
- ローカルSQL検証の再実行：`node scripts/verify-product-points-520.mjs ./tmp/verify-520/node_modules/@electric-sql/pglite`。検証用依存は `tmp/verify-520` のみに導入し、プロジェクトのpackage.json・package-lock.jsonは変更していない。

社長スタイルの指定配色から計算したコントラスト比：ライトの見出し14.43、本文16.24、補助文字5.46、ダークの見出し15.40、本文13.91、補助文字7.53。画面描画後の実測値ではなく、CSSの指定色の計算値。

## マニュアル5点

`C:\Claude\000_Garden\150_System_システム\00_マニュアル\34_付与ポイント表\` に、既存33_派遣管理の名前とHTML形式に合わせて作成。④を先に作成し、版v1.0・日付2026-11-12を記載。①はタブが一つもない現行画面の構成に合わせ、「付与ポイント表」「追加と変更」「保存できないとき」で使い方を説明した。

- `Garden_System_付与ポイント表_0_要点サマリ.html`
- `Garden_System_付与ポイント表_1_操作マニュアル_研修用.html`
- `Garden_System_付与ポイント表_2_仕様書マニュアル_非エンジニア向け.html`
- `Garden_System_付与ポイント表_3_仕様書マニュアル_エンジニア向け.html`
- `Garden_System_付与ポイント表_4_仕様書_Claude読み込み用.md`

## 未実施・制限

ユーザーの禁止事項に従い、git操作、computer-use、ブラウザ操作、本番適用、本番書き込み、Kintone・Chatworkの実呼び出し、Storageへのアップロードは行っていない。`vercel.json` と既存管理表ポータルは変更していない。

ブラウザでの4段階の幅・390px・1384px、明暗切り替え、スクロールバーの描画確認は未実施。共通部品とレスポンシブCSSで対応し、ソースのちらつき検査と画面の単体テストまで確認した。migration適用と実画面での最終確認は残る。
