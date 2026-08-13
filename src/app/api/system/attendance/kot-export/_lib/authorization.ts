import { NextResponse } from "next/server";
import { MANAGER_ROLES } from "@/app/system/_lib/attendance";
import { resolveAttendanceEmployee } from "../../_lib/auth";

export async function authorizeKotExport() {
  const identity = await resolveAttendanceEmployee();
  if (!identity.ok) return { response: NextResponse.json({ ok: false, error: identity.error }, { status: identity.status }) };
  if (!MANAGER_ROLES.has(identity.employee.gardenRole)) {
    return { response: NextResponse.json({ ok: false, error: "閲覧権限がありません" }, { status: 403 }) };
  }
  return { identity };
}
