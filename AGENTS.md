<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

一定間隔の取り直しは src/lib/hooks/usePolling.ts の usePolling だけを使う。
useEffect の依存に親が毎回作り直す配列・関数を入れて取りに行かない。
cron や取り直しを足すときは 1 日の回数を見積もって指示書に書く。
