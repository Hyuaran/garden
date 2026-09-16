import { NextResponse } from "next/server";
import { verifyBearerRequest } from "@/lib/cron-auth";
import { importBankMaster } from "./_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });
  try {
    return NextResponse.json(await importBankMaster());
  } catch (error) {
    console.error("[bank-master-import] failed", error);
    return NextResponse.json({ ok: false, error: "import_failed" }, { status: 500 });
  }
}

export async function GET(request: Request) { return handler(request); }
export async function POST(request: Request) { return handler(request); }
