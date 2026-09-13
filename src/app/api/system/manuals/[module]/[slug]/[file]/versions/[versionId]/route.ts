import {
  contentTypeForDoc,
  jsonError,
  MANUAL_BUCKET,
  MANUAL_SECURITY_HEADERS,
  getManualAdmin,
  requireManualDocAccess,
  type ManualVersionRecord,
} from "@/app/api/system/manuals/_lib/manuals-api";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ module: string; slug: string; file: string; versionId: string }> },
) {
  const { module: moduleSlug, slug, file, versionId } = await params;
  const access = await requireManualDocAccess({ module: moduleSlug, slug, file }, { superAdminOnly: true });
  if (!access.ok) return access.response;

  const admin = getManualAdmin();
  const { data: version, error } = await admin
    .from("system_manual_versions")
    .select("id,module,slug,file,storage_path,size,uploaded_by,uploaded_at,note")
    .eq("id", versionId)
    .eq("module", access.manual.moduleSlug)
    .eq("slug", access.manual.slug)
    .eq("file", access.doc.file)
    .maybeSingle<ManualVersionRecord>();
  if (error) return jsonError(500, "版を読み込めませんでした");
  if (!version) return jsonError(404, "manual version not found");

  const { data, error: storageError } = await admin.storage.from(MANUAL_BUCKET).download(version.storage_path);
  if (storageError || !data) return jsonError(404, "manual version not found");

  return new Response(await data.arrayBuffer(), {
    headers: {
      ...MANUAL_SECURITY_HEADERS,
      "Content-Type": contentTypeForDoc(access.doc),
    },
  });
}
