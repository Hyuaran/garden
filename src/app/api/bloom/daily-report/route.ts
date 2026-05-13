/**
 * /api/bloom/daily-report
 *
 * dispatch main- No. 91 N 案 GO + 自走判断 #7 (2026-05-07 19:00 着手)
 *
 * GET ?date=YYYY-MM-DD
 *   - 指定日の root_daily_reports + root_daily_report_logs を返す
 *   - date 省略時は当日 (Asia/Tokyo)
 *   - dev (NODE_ENV=development) かつ Supabase env 未設定なら mock fallback
 *
 * POST body: { date, workstyle, is_irregular, irregular_label, logs: [{ category, module, content, ord }] }
 *   - root_daily_reports に upsert (1 日 1 レコード)
 *   - root_daily_report_logs に対象 date の既存 logs を delete → 受信 logs を insert (置換方式)
 *   - dev mock 環境では Supabase 接続せず { ok: true, source: "mock" } を返す
 *
 * Supabase schema (handoff 書 + progress-html/route.ts §fetchData の SELECT 列から把握):
 *   - root_daily_reports: date (PK), workstyle (office/home/irregular), is_irregular (bool), irregular_label (text)
 *   - root_daily_report_logs: report_date, category (work/tomorrow/special), module (text), content (text), ord (int)
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Workstyle = "office" | "home" | "irregular";
type LogCategory = "work" | "tomorrow" | "special";

type DailyReportRow = {
  date: string;
  workstyle: Workstyle;
  is_irregular: boolean;
  irregular_label: string | null;
};

type DailyReportLogRow = {
  report_date: string;
  category: LogCategory;
  module: string;
  content: string;
  ord: number | null;
};

type ApiResponse = {
  date: string;
  report: DailyReportRow | null;
  logs: DailyReportLogRow[];
  source: "supabase" | "mock";
};

const MOCK_REPORT: DailyReportRow = {
  date: "2026-05-07",
  workstyle: "irregular",
  is_irregular: true,
  irregular_label: "Garden 統一認証ゲート + Daily Report 本実装の集中着手日",
};

const MOCK_LOGS: DailyReportLogRow[] = [
  { report_date: "2026-05-07", category: "work", module: "bloom", content: "Garden Series 統一ログイン画面 (/login) 実装、目アイコン + 状態保持統合", ord: 1 },
  { report_date: "2026-05-07", category: "work", module: "bloom", content: "garden-home (/) を 12 モジュール円環の React component 化", ord: 2 },
  { report_date: "2026-05-07", category: "work", module: "bloom", content: "GardenHomeGate (admin/super_admin 限定) 実装、ROLE_LANDING_MAP 共通定数化", ord: 3 },
  { report_date: "2026-05-07", category: "tomorrow", module: "bloom", content: "Phase A-2.1 統合 KPI ダッシュボード Task 1-10 実装着手 (writing-plans plan 準拠)", ord: 1 },
];

function todayJst(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function buildSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function fetchByDate(sb: SupabaseClient, date: string): Promise<ApiResponse> {
  const [r, l] = await Promise.all([
    sb
      .from("root_daily_reports")
      .select("date, workstyle, is_irregular, irregular_label")
      .eq("date", date)
      .maybeSingle(),
    sb
      .from("root_daily_report_logs")
      .select("report_date, category, module, content, ord")
      .eq("report_date", date)
      .order("category", { ascending: true })
      .order("ord", { ascending: true }),
  ]);

  const report = (r.data as DailyReportRow | null) ?? null;
  const logs = ((l.data ?? []) as DailyReportLogRow[]).filter(
    (row) => row.report_date && row.category && row.module && row.content,
  );

  return { date, report, logs, source: "supabase" };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? todayJst();

  const sb = buildSupabaseClient();
  const isDev = process.env.NODE_ENV === "development";

  if (!sb) {
    if (isDev) {
      return NextResponse.json(
        { date, report: MOCK_REPORT, logs: MOCK_LOGS, source: "mock" } satisfies ApiResponse,
        { headers: { "X-Data-Source": "mock" } },
      );
    }
    return NextResponse.json(
      { error: "Supabase env not configured" },
      { status: 500 },
    );
  }

  try {
    const data = await fetchByDate(sb, date);
    if (!data.report && data.logs.length === 0 && isDev) {
      return NextResponse.json(
        { date, report: MOCK_REPORT, logs: MOCK_LOGS, source: "mock" } satisfies ApiResponse,
        { headers: { "X-Data-Source": "mock" } },
      );
    }
    return NextResponse.json(data, { headers: { "X-Data-Source": "supabase" } });
  } catch (err) {
    if (isDev) {
      return NextResponse.json(
        { date, report: MOCK_REPORT, logs: MOCK_LOGS, source: "mock" } satisfies ApiResponse,
        { headers: { "X-Data-Source": "mock-fallback" } },
      );
    }
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

type PostBody = {
  date: string;
  workstyle: Workstyle;
  is_irregular?: boolean;
  irregular_label?: string | null;
  logs: Array<{
    category: LogCategory;
    module: string;
    content: string;
    ord?: number | null;
  }>;
};

function isValidWorkstyle(v: unknown): v is Workstyle {
  return v === "office" || v === "home" || v === "irregular";
}

function isValidCategory(v: unknown): v is LogCategory {
  return v === "work" || v === "tomorrow" || v === "special";
}

function validateBody(raw: unknown): { ok: true; body: PostBody } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "body must be an object" };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) {
    return { ok: false, error: "date must be YYYY-MM-DD" };
  }
  if (!isValidWorkstyle(o.workstyle)) {
    return { ok: false, error: "workstyle must be office/home/irregular" };
  }
  if (!Array.isArray(o.logs)) {
    return { ok: false, error: "logs must be an array" };
  }
  for (const log of o.logs) {
    if (typeof log !== "object" || log === null) {
      return { ok: false, error: "log entry must be an object" };
    }
    const lg = log as Record<string, unknown>;
    if (!isValidCategory(lg.category)) {
      return { ok: false, error: "log.category must be work/tomorrow/special" };
    }
    if (typeof lg.module !== "string" || lg.module.length === 0) {
      return { ok: false, error: "log.module must be non-empty string" };
    }
    if (typeof lg.content !== "string" || lg.content.length === 0) {
      return { ok: false, error: "log.content must be non-empty string" };
    }
  }
  return {
    ok: true,
    body: {
      date: o.date,
      workstyle: o.workstyle,
      is_irregular: typeof o.is_irregular === "boolean" ? o.is_irregular : false,
      irregular_label: typeof o.irregular_label === "string" ? o.irregular_label : null,
      logs: o.logs as PostBody["logs"],
    },
  };
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const v = validateBody(raw);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }
  const body = v.body;

  const isDev = process.env.NODE_ENV === "development";
  const sb = buildSupabaseClient();

  if (!sb) {
    if (isDev) {
      return NextResponse.json(
        { ok: true, source: "mock", date: body.date, logs_count: body.logs.length },
        { headers: { "X-Data-Source": "mock" } },
      );
    }
    return NextResponse.json({ error: "Supabase env not configured" }, { status: 500 });
  }

  try {
    const reportRow: DailyReportRow = {
      date: body.date,
      workstyle: body.workstyle,
      is_irregular: body.is_irregular ?? false,
      irregular_label: body.irregular_label ?? null,
    };
    const { error: upsertErr } = await sb
      .from("root_daily_reports")
      .upsert(reportRow, { onConflict: "date" });
    if (upsertErr) {
      return NextResponse.json({ error: `upsert report failed: ${upsertErr.message}` }, { status: 500 });
    }

    const { error: delErr } = await sb
      .from("root_daily_report_logs")
      .delete()
      .eq("report_date", body.date);
    if (delErr) {
      return NextResponse.json({ error: `delete old logs failed: ${delErr.message}` }, { status: 500 });
    }

    if (body.logs.length > 0) {
      const insertRows: DailyReportLogRow[] = body.logs.map((l, i) => ({
        report_date: body.date,
        category: l.category,
        module: l.module.toLowerCase(),
        content: l.content,
        ord: l.ord ?? i + 1,
      }));
      const { error: insErr } = await sb
        .from("root_daily_report_logs")
        .insert(insertRows);
      if (insErr) {
        return NextResponse.json({ error: `insert logs failed: ${insErr.message}` }, { status: 500 });
      }
    }

    return NextResponse.json(
      { ok: true, source: "supabase", date: body.date, logs_count: body.logs.length },
      { headers: { "X-Data-Source": "supabase" } },
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
