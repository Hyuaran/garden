import { NextResponse } from "next/server";

import { buildTossRecord, resolveSubmissionPartnerCode, validateTossInput } from "@/app/p/toss/_lib/form";
import { addRecord } from "@/app/p/toss/_lib/kintone.server";
import { requirePartnerOrStaff, tossError, TossApiError } from "@/app/p/_lib/server-auth";

export const runtime = "nodejs";
const DEMO_PARTNER_CODE = "9999999";

export async function POST(request: Request) {
  try {
    const access = await requirePartnerOrStaff();
    const input = validateTossInput(await request.json());
    let partnerCode: string;
    try { partnerCode = resolveSubmissionPartnerCode(access.kind, access.kind === "partner" ? access.partnerCode : undefined, input.partnerCode); }
    catch { throw new TossApiError("パートナーコードを入力してください", 400); }
    if (partnerCode === DEMO_PARTNER_CODE) return NextResponse.json({ ok: true, demo: true, recordId: "DEMO" });
    const result = await addRecord(process.env.KINTONE_TOSSUP_APP_ID || "", process.env.KINTONE_TOSSUP_TOKEN || "", buildTossRecord(input, partnerCode));
    return NextResponse.json({ ok: true, recordId: result.id, revision: result.revision });
  } catch (error) {
    const result = tossError(error);
    const status = result.status === 500 && error instanceof Error && /必須|不正|7桁/.test(error.message) ? 400 : result.status;
    return NextResponse.json({ ok: false, error: result.message }, { status });
  }
}
