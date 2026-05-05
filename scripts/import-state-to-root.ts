#!/usr/bin/env node
/**
 * Garden Root — state.txt → root_daily_reports / root_daily_report_logs 取り込みスクリプト
 *
 * 対応 dispatch: 2026-05-05(火) 19:00 a-main-012 main- No. 53
 * 関連 migration: 20260505000001 / 20260505000002 / 20260505000003
 *
 * 仕様:
 *   1. state.txt を読み込み（JSON、拡張子 .txt は claude.ai Drive コネクタ制約による）
 *   2. JSON パース
 *   3. root_daily_reports に date キーで upsert
 *   4. root_daily_report_logs から report_date で DELETE（重複防止）
 *   5. work_logs / tomorrow_plans / carryover / planned_for_today を行単位で INSERT
 *   6. content からモジュール抽出（regex）
 *      - "Garden XXX：内容"      → module="XXX", content="内容"
 *      - "Garden XXX(YYY)：内容" → module="XXX", content="(YYY)：内容"
 *      - それ以外                → module=null
 *   7. ord は配列順で 0, 1, 2, ...
 *   8. category マッピング:
 *      - work_logs        → 'work'
 *      - tomorrow_plans   → 'tomorrow'
 *      - carryover        → 'carryover'
 *      - planned_for_today→ 'planned'
 *      - 特記事項（state.txt にないが将来追加）→ 'special'
 *   9. --send-log オプション時、send_log.txt から過去日の送信履歴を
 *      reconstructed source でヘッダーのみ生成（明細なし）
 *
 * 実行例:
 *   npx tsx scripts/import-state-to-root.ts                   # 既定パスで実行
 *   npx tsx scripts/import-state-to-root.ts --dry-run         # DB 書込なし、パース結果のみ
 *   npx tsx scripts/import-state-to-root.ts --send-log        # send_log.txt も取り込み
 *   npx tsx scripts/import-state-to-root.ts --state-path <p>  # 別の state.txt を指定
 *
 * 必須 env（.env.local 自動読込 or process.env から）:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";

// ------------------------------------------------------------
// 既定パス（東海林さん環境）
// ------------------------------------------------------------
const DEFAULT_STATE_PATH =
  "G:\\マイドライブ\\17_システム構築\\07_Claude\\01_東海林美琴\\006_日報自動配信\\state\\state.txt";
const DEFAULT_SEND_LOG_PATH =
  "G:\\マイドライブ\\17_システム構築\\07_Claude\\01_東海林美琴\\006_日報自動配信\\send_log.txt";

// ------------------------------------------------------------
// 型定義
// ------------------------------------------------------------
type StateData = {
  date: string;
  mode?: string;
  workstyle?: string;
  is_irregular?: boolean;
  irregular_label?: string;
  irregular_start?: string;
  irregular_end?: string;
  work_logs?: string[];
  tomorrow_plans?: string[];
  carryover?: string[];
  planned_for_today?: string[];
  sent?: boolean;
  sent_at?: string;
};

type ParsedLog = {
  category: "work" | "tomorrow" | "carryover" | "planned" | "special";
  module: string | null;
  content: string;
  ord: number;
};

type SendLogEntry = {
  sent_at: string; // ISO 8601 (JST +09:00)
  date: string | null; // 対象日（YYYY-MM-DD）or null
  status: string;
};

type CliArgs = {
  statePath: string;
  sendLogPath: string;
  dryRun: boolean;
  withSendLog: boolean;
};

// ------------------------------------------------------------
// .env.local 手動読み込み（dotenv 依存追加を避ける）
// ------------------------------------------------------------
function loadEnvLocal(): void {
  const envPath = ".env.local";
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    const value = rawValue.replace(/^["']|["']$/g, "").trim();
    if (!(key in process.env) && value) {
      process.env[key] = value;
    }
  }
}

// ------------------------------------------------------------
// CLI 引数パース
// ------------------------------------------------------------
function parseArgs(argv: string[]): CliArgs {
  let statePath = DEFAULT_STATE_PATH;
  let sendLogPath = DEFAULT_SEND_LOG_PATH;
  let dryRun = false;
  let withSendLog = false;

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--send-log") withSendLog = true;
    else if (a === "--state-path") statePath = argv[++i];
    else if (a === "--send-log-path") {
      withSendLog = true;
      sendLogPath = argv[++i];
    } else if (a === "--help" || a === "-h") {
      console.log(
        "usage: tsx scripts/import-state-to-root.ts [--dry-run] [--send-log] [--state-path <path>] [--send-log-path <path>]",
      );
      process.exit(0);
    }
  }
  return { statePath, sendLogPath, dryRun, withSendLog };
}

// ------------------------------------------------------------
// state.txt パース
// ------------------------------------------------------------
function parseState(statePath: string): StateData {
  const raw = fs.readFileSync(statePath, "utf8");
  return JSON.parse(raw) as StateData;
}

// ------------------------------------------------------------
// content からモジュール抽出
//   "Garden XXX：内容"      → module="XXX", content="内容"
//   "Garden XXX(YYY)：内容" → module="XXX", content="(YYY)：内容"
//   それ以外                → module=null
// ------------------------------------------------------------
export function extractModule(content: string): {
  module: string | null;
  cleanContent: string;
} {
  const m = content.match(/^Garden\s+([A-Za-z]+)([:：(].*)$/);
  if (m) {
    const moduleName = m[1];
    const rest = m[2];
    if (rest.startsWith(":") || rest.startsWith("：")) {
      // 純粋なコロン区切り → コロン除去
      return { module: moduleName, cleanContent: rest.slice(1) };
    } else {
      // "(YYY)：..." 形式 → そのまま残す
      return { module: moduleName, cleanContent: rest };
    }
  }
  return { module: null, cleanContent: content };
}

// ------------------------------------------------------------
// workstyle 正規化
// ------------------------------------------------------------
function normalizeWorkstyle(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw === "事務所作業" || raw === "office") return "office";
  if (raw === "自宅作業" || raw === "home") return "home";
  if (raw === "不規則" || raw === "irregular") return "irregular";
  return raw; // 不明値はそのまま保持（後で見直し）
}

// ------------------------------------------------------------
// state → ParsedLog[]
// ------------------------------------------------------------
function parseArray(
  arr: string[] | undefined,
  category: ParsedLog["category"],
): ParsedLog[] {
  if (!arr) return [];
  return arr.map((content, idx) => {
    const { module, cleanContent } = extractModule(content);
    return { category, module, content: cleanContent, ord: idx };
  });
}

function stateToLogs(state: StateData): ParsedLog[] {
  return [
    ...parseArray(state.work_logs, "work"),
    ...parseArray(state.tomorrow_plans, "tomorrow"),
    ...parseArray(state.carryover, "carryover"),
    ...parseArray(state.planned_for_today, "planned"),
  ];
}

// ------------------------------------------------------------
// send_log.txt パース
//   旧形式: "[2026-04-16 12:12:05] OK"            → date=null（記録対象外）
//   新形式: "[2026-04-17 08:59:22] OK date=2026-04-16" → date="2026-04-16"
// ------------------------------------------------------------
function parseSendLog(sendLogPath: string): SendLogEntry[] {
  const raw = fs.readFileSync(sendLogPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const entries: SendLogEntry[] = [];
  for (const line of lines) {
    const m = line.match(
      /^\[(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\]\s+(\S+)(?:\s+date=(\d{4}-\d{2}-\d{2}))?/,
    );
    if (!m) continue;
    const [, dateStr, timeStr, status, dateField] = m;
    // タイムゾーン: 東海林さん運用環境は JST 想定（+09:00）
    const sentAt = `${dateStr}T${timeStr}+09:00`;
    entries.push({
      sent_at: sentAt,
      date: dateField ?? null,
      status,
    });
  }
  return entries;
}

// ------------------------------------------------------------
// メイン
// ------------------------------------------------------------
async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv);

  console.log("[import-state-to-root] start");
  console.log(`  statePath:     ${args.statePath}`);
  console.log(`  sendLogPath:   ${args.withSendLog ? args.sendLogPath : "(skip)"}`);
  console.log(`  dryRun:        ${args.dryRun}`);

  // ---- state.txt 読み込み ----
  if (!fs.existsSync(args.statePath)) {
    console.error(`[error] state.txt not found at: ${args.statePath}`);
    process.exit(1);
  }
  const state = parseState(args.statePath);

  console.log(`\n[parsed state] date=${state.date}`);
  console.log(`  workstyle:        ${state.workstyle ?? "(none)"}`);
  console.log(`  is_irregular:     ${state.is_irregular ?? false}`);
  console.log(`  irregular_label:  ${state.irregular_label ?? "(none)"}`);
  console.log(`  work_logs:        ${(state.work_logs ?? []).length}`);
  console.log(`  tomorrow_plans:   ${(state.tomorrow_plans ?? []).length}`);
  console.log(`  carryover:        ${(state.carryover ?? []).length}`);
  console.log(`  planned_for_today:${(state.planned_for_today ?? []).length}`);

  const logs = stateToLogs(state);
  console.log(`  total logs:       ${logs.length}`);

  // モジュール抽出統計
  const moduleStats: Record<string, number> = {};
  for (const log of logs) {
    const key = log.module ?? "(none)";
    moduleStats[key] = (moduleStats[key] ?? 0) + 1;
  }
  console.log("\n[module extraction stats]");
  for (const [mod, count] of Object.entries(moduleStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${mod}: ${count}`);
  }

  // ---- send_log.txt 読み込み（オプション） ----
  let dateToLatestSend = new Map<string, string>();
  if (args.withSendLog) {
    if (!fs.existsSync(args.sendLogPath)) {
      console.warn(`[warn] send_log.txt not found at: ${args.sendLogPath}`);
    } else {
      const sendLogEntries = parseSendLog(args.sendLogPath);
      console.log(`\n[send_log] entries: ${sendLogEntries.length}`);
      for (const entry of sendLogEntries) {
        if (entry.date && entry.status === "OK") {
          const prev = dateToLatestSend.get(entry.date);
          if (!prev || prev < entry.sent_at) {
            dateToLatestSend.set(entry.date, entry.sent_at);
          }
        }
      }
      console.log(`  unique dates with OK send: ${dateToLatestSend.size}`);
    }
  }

  // ---- dry-run の場合は早期 return ----
  if (args.dryRun) {
    console.log("\n[dry-run] DB 書込みスキップ。実 DB 反映するなら --dry-run を外してください。");
    console.log("\n[dry-run] sample logs (first 3):");
    for (const log of logs.slice(0, 3)) {
      const preview = log.content.length > 80 ? log.content.slice(0, 80) + "..." : log.content;
      console.log(`  - [${log.category}/${log.module ?? "-"}] ord=${log.ord}: ${preview}`);
    }
    return;
  }

  // ---- Supabase 接続 ----
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("[error] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
    console.error("  hint: .env.local に設定するか、--dry-run で動作確認してください");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ---- 1. root_daily_reports に upsert ----
  const sentAtFromLog = dateToLatestSend.get(state.date) ?? null;
  const { error: headerError } = await supabase
    .from("root_daily_reports")
    .upsert(
      {
        date: state.date,
        workstyle: normalizeWorkstyle(state.workstyle),
        is_irregular: state.is_irregular ?? false,
        irregular_label: state.irregular_label ?? null,
        chatwork_sent: state.sent ?? !!sentAtFromLog,
        chatwork_sent_at: sentAtFromLog,
        source: "state.txt",
      },
      { onConflict: "date" },
    );
  if (headerError) {
    console.error("[error] root_daily_reports upsert failed:", headerError.message);
    process.exit(1);
  }
  console.log(`\n[ok] root_daily_reports upserted: date=${state.date}`);

  // ---- 2. root_daily_report_logs を DELETE → INSERT ----
  const { error: deleteError } = await supabase
    .from("root_daily_report_logs")
    .delete()
    .eq("report_date", state.date);
  if (deleteError) {
    console.error("[error] root_daily_report_logs delete failed:", deleteError.message);
    process.exit(1);
  }
  console.log(`[ok] root_daily_report_logs cleared for date=${state.date}`);

  // ---- 3. INSERT ----
  if (logs.length > 0) {
    const rows = logs.map((log) => ({
      report_date: state.date,
      category: log.category,
      module: log.module,
      content: log.content,
      ord: log.ord,
    }));
    const { error: insertError } = await supabase.from("root_daily_report_logs").insert(rows);
    if (insertError) {
      console.error("[error] root_daily_report_logs insert failed:", insertError.message);
      process.exit(1);
    }
    console.log(`[ok] root_daily_report_logs inserted: ${logs.length} rows`);
  }

  // ---- 4. send_log.txt の過去日（state.date と異なる日）をヘッダーのみ補完 ----
  if (args.withSendLog && dateToLatestSend.size > 0) {
    const headers: Array<{
      date: string;
      chatwork_sent: boolean;
      chatwork_sent_at: string;
      source: string;
    }> = [];
    for (const [date, sentAt] of dateToLatestSend) {
      if (date === state.date) continue; // 既に処理済み
      headers.push({
        date,
        chatwork_sent: true,
        chatwork_sent_at: sentAt,
        source: "reconstructed",
      });
    }
    if (headers.length > 0) {
      const { error: pastError } = await supabase
        .from("root_daily_reports")
        .upsert(headers, { onConflict: "date" });
      if (pastError) {
        console.warn("[warn] past headers upsert failed:", pastError.message);
      } else {
        console.log(`[ok] reconstructed headers from send_log: ${headers.length} rows`);
      }
    }
  }

  // ---- 5. 集計 ----
  const { count: reportCount } = await supabase
    .from("root_daily_reports")
    .select("*", { count: "exact", head: true });
  const { count: logCount } = await supabase
    .from("root_daily_report_logs")
    .select("*", { count: "exact", head: true });
  const { count: progressCount } = await supabase
    .from("root_module_progress")
    .select("*", { count: "exact", head: true });

  console.log("\n[summary]");
  console.log(`  root_daily_reports:     ${reportCount ?? "?"} rows`);
  console.log(`  root_daily_report_logs: ${logCount ?? "?"} rows`);
  console.log(`  root_module_progress:   ${progressCount ?? "?"} rows`);
  console.log("\n[import-state-to-root] done");
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
