import { NextResponse } from "next/server";

import {
  archivedStoragePath,
  contentTypeForDoc,
  currentStoragePath,
  insertVersionRecord,
  jsonError,
  MANUAL_BUCKET,
  MANUAL_SECURITY_HEADERS,
  getManualAdmin,
  requireManualDocAccess,
  timestampForVersion,
  type ManualVersionRecord,
} from "@/app/api/system/manuals/_lib/manuals-api";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ module: string; slug: string; file: string }> },
) {
  const { module: moduleSlug, slug, file } = await params;
  const access = await requireManualDocAccess({ module: moduleSlug, slug, file }, { superAdminOnly: true });
  if (!access.ok) return access.response;

  const body = await request.json().catch(() => null) as { versionId?: unknown } | null;
  const versionId = typeof body?.versionId === "string" ? body.versionId : "";
  if (!versionId) return jsonError(400, "この版に戻せませんでした（版を選んでください）");

  const admin = getManualAdmin();
  const { data: version, error } = await admin
    .from("system_manual_versions")
    .select("id,module,slug,file,storage_path,size,uploaded_by,uploaded_at,note")
    .eq("id", versionId)
    .eq("module", access.manual.moduleSlug)
    .eq("slug", access.manual.slug)
    .eq("file", access.doc.file)
    .maybeSingle<ManualVersionRecord>();
  if (error) return jsonError(500, "この版に戻せませんでした（版を確認できませんでした）");
  if (!version) return jsonError(404, "この版に戻せませんでした（版が見つかりません）");

  const bucket = admin.storage.from(MANUAL_BUCKET);
  const { data: restoreBlob, error: restoreDownloadError } = await bucket.download(version.storage_path);
  if (restoreDownloadError || !restoreBlob) return jsonError(404, "この版に戻せませんでした（版のファイルが見つかりません）");

  const currentPath = currentStoragePath(access.manual, access.doc);
  const archivePath = archivedStoragePath(access.manual, access.doc, timestampForVersion());
  const { data: currentBlob } = await bucket.download(currentPath);
  if (currentBlob) {
    const { error: copyError } = await bucket.copy(currentPath, archivePath);
    if (copyError) return jsonError(500, "この版に戻せませんでした（今の版を履歴に残せませんでした）");
    await insertVersionRecord({
      module: access.manual.moduleSlug,
      slug: access.manual.slug,
      file: access.doc.file,
      storagePath: archivePath,
      size: currentBlob.size,
      uploadedBy: access.user.name,
      note: "復元前の版",
    });
  }

  const { error: uploadError } = await bucket.upload(currentPath, await restoreBlob.arrayBuffer(), {
    contentType: contentTypeForDoc(access.doc),
    upsert: true,
  });
  if (uploadError) return jsonError(500, "この版に戻せませんでした（保存できませんでした）");

  const restored = await insertVersionRecord({
    module: access.manual.moduleSlug,
    slug: access.manual.slug,
    file: access.doc.file,
    storagePath: currentPath,
    size: restoreBlob.size,
    uploadedBy: access.user.name,
    note: "いま表示中",
  });

  return NextResponse.json({ ok: true, version: restored }, { headers: MANUAL_SECURITY_HEADERS });
}
