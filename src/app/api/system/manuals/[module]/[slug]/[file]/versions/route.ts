import { NextResponse } from "next/server";

import {
  currentStoragePath,
  formatVersion,
  jsonError,
  MANUAL_SECURITY_HEADERS,
  getManualAdmin,
  requireManualDocAccess,
  type ManualVersionRecord,
} from "@/app/api/system/manuals/_lib/manuals-api";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ module: string; slug: string; file: string }> },
) {
  const { module: moduleSlug, slug, file } = await params;
  const access = await requireManualDocAccess({ module: moduleSlug, slug, file }, { superAdminOnly: true });
  if (!access.ok) return access.response;

  const admin = getManualAdmin();
  const { data, error } = await admin
    .from("system_manual_versions")
    .select("id,module,slug,file,storage_path,size,uploaded_by,uploaded_at,note")
    .eq("module", access.manual.moduleSlug)
    .eq("slug", access.manual.slug)
    .eq("file", access.doc.file)
    .order("uploaded_at", { ascending: false })
    .limit(50);
  if (error) return jsonError(500, "版の履歴を読み込めませんでした");

  const currentPath = currentStoragePath(access.manual, access.doc);
  const rows = (data ?? []) as ManualVersionRecord[];
  const current = rows.find((row) => row.storage_path === currentPath) ?? null;
  const versions = rows.filter((row) => row.storage_path !== currentPath).map(formatVersion);

  return NextResponse.json({ ok: true, current: current ? formatVersion(current) : null, versions }, { headers: MANUAL_SECURITY_HEADERS });
}
