# Codex-521 作業報告（2026-11-12）

## 実装
- `src/app/soil/layout.tsx`、`_components/SoilShell.tsx`、`_constants/menus.ts`：共通 ModuleShell による Soil の殻。ホームと閲覧可能なページだけの左メニュー、利用者・所属・役職・ログアウト。未ログインは開こうとした URL を returnTo にしてログインへ転送。
- `src/app/soil/page.tsx`、`view.tsx`、`soil.module.css`：仮画面を廃止し、閲覧権限に従うカード一覧。共通パンくず・見出し・歯車・更新表示と Root の社長スタイルの色変数を利用。説明文は指示書の指定を優先して表示。
- `src/app/system/product-points/` の画面・サーバー処理・テスト・CSS（8ファイル）を `src/app/soil/product-points/` に移設。表・絞り込み・小窓・保存ロジック・データは維持。パンくずを Soil にし、歯車の入口を明示。
- `src/app/system/product-points/page.tsx` は `/soil/product-points` への転送に変更。
- `src/app/system/_components/ShachoShell/shacho-shell-config.ts`：System の付与ポイント表メニューを削除。
- `src/app/system/manuals/_lib/manuals-registry.ts`：既存マニュアルの登録と Storage の保存先は維持し、対応する画面を `/soil/product-points` に変更。
- `src/lib/auth/soil-view-scopes.ts`、`view-permission.ts`、`permission-registry.ts`、`src/app/root/permissions/PermissionsClient.tsx`：Soil の2画面を登録。旧 System の閲覧画面は一覧から外し、旧キー自体は互換のため保持。
- 新規テスト：`src/app/soil/soil.test.tsx`、`layout.test.tsx`、`src/lib/auth/soil-view.test.ts`。移設後の server テストに閲覧拒否・個人許可・書き込み拒否を追加。
- System メニューとマニュアルのテストの古い期待値（派遣管理・付与ポイント表が増える前の件数）を現状に修正し、Soil のマニュアル対応を検証。

## 権限キーの判断
`soil-overview` は leaf-forest 側の定義をそのまま参照する。キーと既定役職を変更せず、既存設定・リスト API・全体検索への影響を避けた。

付与ポイント表は `soil-product-points`、既定は責任者以上。新キーの設定がなければ `system-product-points` の役職・個人設定を参照し、新しい設定を優先する。読み取りも canView を確認してから管理者接続を渡す。従来の requireManager 固定判定を requireEmployee＋canView にし、歯車で個人に閲覧を許可した場合も利用できるようにした。書き込みは全権管理者だけ。

歯車の保存 RPC は DB の scope 登録を検証するため、`supabase/migrations/20261112000521_soil_module_scopes.sql` を作成した。新 scope を追加し、旧設定が存在し新設定がない場合だけ複写する。ホームとポイント表のデータ・関数は変更しない。**未適用。Claude による確認・適用が必要。**

## マニュアル
`C:/Claude/000_Garden/150_System_システム/00_マニュアル/34_付与ポイント表/` の5ファイルを④から更新。画面の場所を「Soil ＞ 付与ポイント表」（`/soil/product-points`）、版 v1.1、日付 2026-11-12 に統一。ファイル名と登録済み Storage パスは維持。Storage へのアップロードなし。

## 検証
- `npx tsc --noEmit`：成功（最終変更後も確認）。
- 指定コマンド `npx vitest run src/app/soil src/lib/product-points src/lib/auth src/app/api/soil src/lib/ui/no-flicker-source.test.ts`：1289成功、2失敗。ログ `outputs/codex-521-tests.log`。
- 失敗1：`src/lib/auth/root-view-integration.test.tsx` の従業員 API テスト。模擬 DB に `.in()` がなく TypeError。今回その API とテストは変更していない。
- 失敗2：`src/lib/auth/system-view-integration.test.tsx` の SQL scope 一致テスト。既存シフト scope のラベル「シフト：自分のシフトを提出」が読み込んでいる SQL と一致しない。今回シフトの定義と SQL は変更していない。
- Soil・ポイント計算・ちらつき・System メニュー・マニュアル対応の絞り込み検証：11ファイル99テスト成功。ログ `outputs/codex-521-focused-tests.log`。旧 URL 転送、未ログイン転送、メニューとカードの表示制限、旧権限の継承、新設定の優先、全権管理者限定の保存を含む。
- 新規の一定間隔の取得・cron：0回/日。vercel.json の変更なし。
- CSS の色値から計算したコントラスト比：明 見出し14.43:1・本文16.24:1・補助5.46:1、暗 見出し12.23:1・本文14.12:1・補助8.91:1。共通 ModuleShell の明暗変数を継承。

## 未実施・残る事項
ブラウザ・computer-use は指示により不使用。1384px・390px の実画面、画面切り替えとOS側の明暗の目視確認は未実施。幅はCSSの折り返し・共通の引き出し式メニュー・上限なしの本文で対応。SQL はファイルの作成と内容検査のみで、実DB上の実行検証は行っていない。指定テスト全体は上記2件が残り、全成功ではない。

git の操作・コミット、本番の読み書き、Kintone・Chatwork の実呼び出し、Storage アップロード、デプロイは行っていない。
