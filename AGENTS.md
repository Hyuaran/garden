<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

一定間隔の取り直しは src/lib/hooks/usePolling.ts の usePolling だけを使う。
useEffect の依存に親が毎回作り直す配列・関数を入れて取りに行かない。
cron や取り直しを足すときは 1 日の回数を見積もって指示書に書く。

## Vercel の料金を増やさない作り（2026-11-13・正本 Obsidian 900_Rules/030 §3）
- 常駐の係（ホスト PC など）が短い間隔で「仕事はあるか」を聞く作りは、Vercel の API を通さず Supabase の関数を直接呼ぶ（anon キー＋係の秘密を sha256 で照合する security definer。例：system_relay_agent_pull・system_zenkaku_agent_next・system_callcenter_agent_take_request）。
- 定期的に送り直す作りは、前回送った中身の要約を持って変わった行だけ送る。大きな本文は gzip で送り、受け口で展開する。
- 外のサービス（Microsoft・KING OF TIME・Kintone など）が答えないときは早く切り上げる（1 回 15 秒前後の上限・再試行は少なく・最初の失敗で残りを読まない・読む範囲と実行全体に上限）。
- 報告には、Vercel が 1 日に何回呼ばれるかの見積もりを書く。

## 更新マーク（2026-11-13・正本 Obsidian 900_Rules/050 §4）
- 最終更新の横の更新マーク（UpdatedStamp）は全画面で押せる形にする（onRefresh を渡す）。
- 押したら、その画面の数字の元（Kintone・KING OF TIME・FileMaker・マネーフォワード・INNOVERA など）からすぐ強制的に取り直し、終わったら画面を読み直す。定期の取り込みや差分送信があっても待たない・省かない。元が Garden の中なら読み直しでよい。
- ホスト PC の係を通す元は「取り直しの依頼」を DB に入れて係が DB 直接で拾う（system_call_sync_requests の形）。待ちは押したときだけ usePolling。失敗は画面の上に出す。
