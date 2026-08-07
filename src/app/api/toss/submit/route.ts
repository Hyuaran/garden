import { NextResponse } from "next/server";

import { buildTossRecord, validateTossInput } from "@/app/toss/_lib/form";
import { addRecord } from "@/app/toss/_lib/kintone.server";
import { requireActiveTossPartner, tossError } from "@/app/toss/_lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const partner = await requireActiveTossPartner();
    const input = validateTossInput(await request.json());
    const result = await addRecord(process.env.KINTONE_TOSSUP_APP_ID || "", process.env.KINTONE_TOSSUP_TOKEN || "", buildTossRecord(input, partner.partner_code));
    return NextResponse.json({ ok: true, recordId: result.id, revision: result.revision });
  } catch (error) {
    const result = tossError(error);
    const status = result.status === 500 && error instanceof Error && /必須|不正|7桁/.test(error.message) ? 400 : result.status;
    return NextResponse.json({ ok: false, error: result.message }, { status });
  }
}
