import { NextResponse } from "next/server";

import { verifyBearerRequest } from "@/lib/cron-auth";

import { refreshListOptions } from "../../analysis/_lib/analysis";
import { refreshTableCounts } from "../../_lib/table-counts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function GET(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  const options = await refreshListOptions().catch((error) => ({
    optionsRefreshed: false,
    optionsRefreshError: errorMessage(error, "options_refresh_failed"),
  }));
  const tableCounts = await refreshTableCounts().catch((error) => ({
    tableCountsRefreshed: false,
    tableCountsError: errorMessage(error, "table_counts_refresh_failed"),
  }));

  const ok = options.optionsRefreshed && tableCounts.tableCountsRefreshed;
  return NextResponse.json(
    {
      ok,
      ...options,
      ...tableCounts,
    },
    { status: ok ? 200 : 500 },
  );
}
