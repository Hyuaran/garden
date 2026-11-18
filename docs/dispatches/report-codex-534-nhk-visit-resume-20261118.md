# Codex-534 NHK訪問業務報告「再開」実装報告

## 変更ファイル

- `src/app/system/forms/nhk-visit/_lib/nhk-visit.ts`
- `src/app/system/forms/nhk-visit/NhkVisitClient.tsx`
- `src/app/api/system/nhk-visit/route.ts`
- `src/app/system/forms/nhk-visit/_lib/nhk-visit-summary.ts`
- `src/app/system/forms/nhk-visit/_lib/nhk-visit-summary.server.ts`
- `supabase/migrations/20261118000534_nhk_visit_resume.sql`
- `src/app/system/forms/nhk-visit/_lib/nhk-visit.test.ts`
- `src/app/system/forms/nhk-visit/_lib/nhk-visit-summary.test.ts`
- `src/app/system/forms/nhk-visit/NhkVisitClient.test.tsx`
- `src/app/api/system/nhk-visit/route.test.ts`
- `src/app/api/system/nhk-visit/daily-report/route.test.ts`
- `src/app/m/nhk/page.test.tsx`

PC・スマホ共通フォームの「住所変更」の下に「再開」を追加し、解決と収納を入力できるようにした。直近 1 週間の履歴、個別報告、Chatwork・LINE の日次集計、Supabase 保存、Kintone 転記に反映した。個別報告では解決を「件」、収納を「口」で表示する。旧画面から項目を省略して送信した場合と過去の報告は 0 として扱う。成約合計、月累計、見立ては従来どおり成約件数で計算する。

## 検証結果

- `npx vitest run src/app/system/forms/nhk-visit src/app/api/system/nhk-visit src/app/m/nhk` は 6 ファイル・35 テスト成功。
- `npx vitest run src/app/api/system/line/webhook/route.test.ts` は 1 ファイル・25 テスト成功。
- `npx tsc --noEmit --incremental false` はエラーなし。型チェックのキャッシュファイルを生成しない設定で実行した。

## 反映時の確認事項

- 新コードの稼働前にマイグレーションの適用が必要。Kintone アプリ 241 には数値項目 `再開_解決` と `再開_収納` が必要。本番での適用と項目の確認は未実施。
- 報告者が 0 人の日は、集計文の「本日の合計」に解決・収納とも 0 を表示する。Chatwork の定期配信は従来どおり報告がない日はスキップする。
- Vercel 呼び出しの増分見積もりは 0 回／日。NHK 日次集計の既存 cron は 1 回／日（20:30 JST）。フォームの履歴取得は初回表示時と送信成功時の各 1 回で、定期取得は追加なし。
