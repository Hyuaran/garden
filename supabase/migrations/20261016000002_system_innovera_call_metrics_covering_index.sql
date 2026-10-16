-- INNOVERA の集計（system_innovera_metrics）を全期間でも速くする：集計に要る列だけを持つ索引（表本体を読まずに集計できる）。
-- 2026-10-16：過去分 66 万件を取り込んだ後、表本体（raw jsonb が 1 行平均 680 バイト・631MB）をディスクから読み直す待ちで
-- 全期間（約 10 か月）が 20〜50 秒かかり REST の 8 秒で打ち切られていた（Codex-382 で集計の書き方は直した後）。
create index if not exists idx_system_innovera_call_metrics_cover
  on public.system_innovera_call (start_time)
  include (circuit_id, call_type, dial_status, talk_seconds, caller_num, callee_num);
