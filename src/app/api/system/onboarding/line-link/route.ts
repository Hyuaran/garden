import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { onboardingEmployee, OnboardingError } from "@/app/system/onboarding/_lib/onboarding.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createLinkCode } from "@/lib/line/link-code";
export const runtime = "nodejs";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { employee } = await onboardingEmployee();
    const { data, error } = await getSupabaseAdmin().rpc("system_issue_line_link_code", { p_employee_id: employee.employee_id, p_code: createLinkCode() });
    if (error || !data) throw new Error("line_link_failed");
    if (data.linked) return NextResponse.json(data, { headers });
    const message = `連携 ${data.employeeNumber}-${data.code}`;
    const url = `https://line.me/R/oaMessage/${process.env.LINE_STAFF_BASIC_ID || "@586gtqpd"}/?${encodeURIComponent(message)}`;
    const svg = await QRCode.toString(url, { type: "svg", width: 220, margin: 4 });
    return NextResponse.json({ linked: false, message, url, svg }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof OnboardingError ? error.message : "公式 LINE のご案内を表示できませんでした。もう一度お試しください。" }, { status: error instanceof OnboardingError ? error.status : 503, headers });
  }
}
