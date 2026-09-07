import { NextResponse } from "next/server";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { findManual, findManualDoc } from "@/app/system/manuals/_lib/manuals-registry";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: SECURITY_HEADERS });
}

function validRole(value: unknown): GardenRole {
  return GARDEN_ROLE_ORDER.includes(value as GardenRole) ? value as GardenRole : "staff";
}

function isSafeRegisteredFile(file: string) {
  return file.length > 0 && !file.includes("/") && !file.includes("\\") && !file.includes("..");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ module: string; slug: string; file: string }> },
) {
  const { module: moduleSlug, slug, file } = await params;
  if (!isSafeRegisteredFile(file)) return jsonError(404, "manual not found");

  const manual = findManual(moduleSlug, slug);
  const doc = manual ? findManualDoc(manual, file) : null;
  if (!manual || !doc) return jsonError(404, "manual not found");

  const session = await createServerClient();
  const { data: auth } = await session.auth.getUser();
  if (!auth.user) return jsonError(401, "login required");

  const { data: employee, error: employeeError } = await session
    .from("root_employees")
    .select("garden_role")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (employeeError) return jsonError(500, "employee role lookup failed");
  if (!employee) return jsonError(403, "manual access denied");

  const role = validRole(employee.garden_role);
  if (!isRoleAtLeast(role, doc.minRole)) return jsonError(403, "manual access denied");

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .storage
    .from("system-manuals")
    .download(`${manual.storagePrefix}/${doc.file}`);
  if (error || !data) {
    if (doc.kind === "html") {
      const notice = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>body{margin:0;font-family:"Meiryo","Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,sans-serif;color:#5a6b80;background:#f4f5f7;padding:40px 24px;text-align:center;font-size:15px}</style></head><body>この資料はまだ登録されていません。管理者へお問い合わせください。</body></html>';
      return new Response(notice, { status: 404, headers: { ...SECURITY_HEADERS, "Content-Type": "text/html; charset=utf-8" } });
    }
    return jsonError(404, "manual not found");
  }

  return new Response(await data.arrayBuffer(), {
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": doc.kind === "html" ? "text/html; charset=utf-8" : "text/markdown; charset=utf-8",
    },
  });
}
