# Codex-539 顧客一覧の「付与件数」を Garden の付与ポイント表から入れる（2026-11-20）

## 背景
顧客一覧（Kintone アプリ 10）の数値項目「付与件数」（項目コード `付与件数`）は、今は Kintone の条件分岐処理プラグインが古い点数（JUST 1.0・BIGLOBE 1.3・au 1.8・docomo 1.1）を入れている。Garden の付与ポイント表（`soil_product_points`・画面 `/soil/product-points`）が正しい値なので、**Garden の表から付与件数を入れる**ようにし、プラグインはやめる（Codex-538 で他のルールも Garden へ移し中）。
点数の求め方は配信と同じ：`src/lib/product-points` の `resolveChannel`（事業名・リスト名→白地／LP／アライアンス）と `pointFor`（商材名・別名・期間）。商材名は `商材名区分2`、無ければ・表に無ければ `m_product`（`call-report-v3.ts` の `extractPointOrder` と同じ）。期間の判定は **実績日**（空なら受注日）。

## やること
1. 公開の読み取り口 `src/app/api/kintone/product-points/route.ts`（GET）
   - 入力：`product`（商材名区分2）・`master`（m_product）・`business`（事業名）・`list`（B_リスト名）・`date`（YYYY-MM-DD）
   - 返す：`{ points: number | null, product: string | null, channel: "hakuchi"|"lp"|"alliance"|null }`（表に無ければ points null）
   - 個人情報は受け取らない・返さない。認証なし（中身は商材ごとの点数だけ）。不正な入力は 400
   - CORS：`Access-Control-Allow-Origin: https://9j11u0q829lg.cybozu.com`（OPTIONS も）
   - キャッシュ：`Cache-Control: public, s-maxage=300, stale-while-revalidate=600`（同じ問い合わせは 5 分 Vercel の端で返し、呼び出しを増やさない）。表はサーバーで読んで 5 分メモ化
   - 純粋な部分（入力の検証・点数の決定）は `src/lib/product-points/kintone-points.ts` に置いてテスト
2. Kintone の画面のしかけ `public/kintone/garden-fuyo-points.js`（配信 URL `https://garden-os.net/kintone/garden-fuyo-points.js`・アプリ 10 の PC／スマホ）
   - 書き方は `public/kintone/garden-jisseki-rules.js` と同じ形
   - 作成・編集画面で、`商材名区分2`・`事業名`・`B_リスト名`・`実績日`・`受注日` が変わったとき、と保存の直前（submit）に、上の読み取り口に問い合わせて `付与件数` を入れる。表に無ければ `付与件数` は空にせず今の値のまま、画面の上に「付与ポイント表に無い商材です（○○）。Garden の付与ポイント表に追加してください。」と 1 行出す（kintone.app.record.setFieldShown などではなく、`event.error` は使わない＝保存は止めない）
   - submit では Promise を返して、取得を待ってから保存する（5 秒で諦めて今の値のまま保存）
   - 純粋な部分は `module.exports` でテスト `public/kintone/garden-fuyo-points.test.ts`
3. 既存の受注を直すスクリプト `scripts/kokyaku-fuyo-points/backfill.ts`
   - `--from <YYYY-MM-DD>`（実績日の下限・必須）・`--apply`（無ければ見るだけ）
   - アプリ 10 を読むのは `.env.local` の `KINTONE_KANRI_CUSTOMER_TOKEN`（読み取りのみ）。書き込みは環境変数 `KINTONE_ROBOT_AUTH`（`X-Cybozu-Authorization` の値＝base64）を使う。値はログに出さない
   - 1 件ずつの「今の付与件数 → 正しい値」を CSV（`scripts/kokyaku-fuyo-points/logs/backfill-<日時>.csv`・`.gitignore` に追加）に書き、変わる件数・表に無い商材の件数を出す。`--apply` で 100 件ずつ更新
   - 計算は 1 と同じ関数を使う
4. 付与ポイント表を画面で変えたとき（`src/app/soil/product-points/actions.ts`）に、画面に「Kintone の付与件数は、受注を開いて保存したとき、または管理者が反映したときに新しい値になります。」と案内を 1 行足す（自動で Kintone を書き換えるのは今回しない）

## 守ること
- **git 操作禁止**・**ブラウザ・computer-use 禁止**・**本番の Kintone・DB への書き込み禁止**（スクリプトは書くだけ。登録・実行は Claude）
- 別の Codex が `src/app/leaf`・`public/kintone/garden-kokyaku-rules.js` を作業中。そこは触らない
- cron を足さない。報告に Vercel 呼び出しの見積もり（1 日あたり）を書く
- 改行は LF。画面の文字はきちんとした日本語

## 確かめ
- `npx vitest run public/kintone src/lib/product-points src/app/api/kintone scripts/kokyaku-fuyo-points` が緑、`npx tsc --noEmit` でエラーなし

## 報告
`docs/dispatches/report-codex-539-kokyaku-fuyo-points-from-soil-20261120.md`
