# Codex-387b：テレマ配信本文の「受注」を顧客一覧の受注日で数える（2026-10-19）

前の指示書：`docs/dispatches/dispatch-codex-387-call-report-registered-basis-20261019.md`（実装は未コミットで作業ツリーにある）。その上に重ねて直す。

## 東海林さんの決定（2026-10-19・開発ルームの試し送りを見て）
- 文言の形は OK。ただし**申込のカウントはやめる**
- **受注＝顧客一覧（Kintone アプリ 10）で、リスト名（項目コード `B_リスト名`）に事業の名前が入っていて（`WEB_ヒカリのプロ`／`WEB_電気開始受付センター`）、受注日（項目コード `受注日`・日付）がその日のもの**。登録した日は問わない
- **前確待ちは今まで通り**＝その日に LP の顧客アプリに登録された記録のうち対応状況が「前確待ち」（387 の数え方のまま）

本文の形
```
■ヒカリのプロ
発着信：53件（着信17件／発信36件）
初回応答率：100.0％（応答9件／入電9件）
受注率：60.0％（前確待ち2件／受注6件）
対象外率：20.0％
```
- 受注率＝**受注（顧客一覧）÷ その日に LP の顧客アプリに登録された記録（重複を除く）**（387 の分母のまま）。分母 0 は「-」
- 対象外率は 387 のまま

## 本物の確認（Claude 調べ・読むだけ）
- 顧客一覧の読み取りの鍵＝`.env.local` の `KINTONE_KANRI_CUSTOMER_TOKEN`（`src/app/api/soil/list/orders/_lib/order-sync.ts` の `resolveOrderSource` と同じ）。サブドメイン＝`KINTONE_SUBDOMAIN`。読み取りは `src/lib/kintone/records.ts` を使う。GET に Content-Type を付けない
- クエリ例：`B_リスト名 like "WEB_" and 受注日 = "2026-10-16"` → 2026-10-16 は WEB_ヒカリのプロ 5 件・WEB_電気開始受付センター 3 件／10-17 は 4 件・4 件／10-19 は電気 3 件
- 事業とリスト名の対応＝`WEB_` ＋ 事業の名前（LP 事業マスタ＝kintone 239 の bizName）。一致は**リスト名がちょうど `WEB_<bizName>`**（前後の空白は除く）
- 期間（from〜to）で数える（1 日なら受注日＝その日）。顧客一覧が読めないときは受注を「-」にし、notes に「顧客一覧（受注）を取得できませんでした」

## 変えないもの
- PDF・画面の流れ図（話せた人で数える）は変えない
- 初回応答率・⚠Kintone記録なし・0 件の省き方

## テスト
- 本文の 4 行が上の形（申込の表示が無い）
- 受注はリスト名が `WEB_<bizName>` で受注日が期間内のものだけ（別の事業・前日・リスト名が WEB_ で始まるが違う名前は数えない）
- 顧客一覧が読めない →「-」

## 守ること
- commit・push しない。DB・本物の Kintone・Chatwork に接続しない
- 未コミットのお知らせ機能のファイル（`src/app/_components/notices/`・`src/lib/notices/`・`src/app/notices/`・migration 20261019000002・ShachoShell・m/）は触らない
- `npx vitest run src/app/system src/app/api/system/call-report src/app/api/system/call-metrics` と `npx tsc --noEmit -p .` が通ること（Supabase の環境変数が無くて落ちる前からのテストは除く）

## 報告（日本語・コードブロック）
変えたファイルとテストの結果だけ短く。
