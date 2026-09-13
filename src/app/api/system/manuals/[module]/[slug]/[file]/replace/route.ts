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
} from "@/app/api/system/manuals/_lib/manuals-api";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value && "name" in value);
}

function hasExpectedExtension(fileName: string, registeredFile: string) {
  const expected = registeredFile.toLowerCase().endsWith(".md") ? ".md" : ".html";
  return fileName.toLowerCase().endsWith(expected);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ module: string; slug: string; file: string }> },
) {
  const { module: moduleSlug, slug, file } = await params;
  const access = await requireManualDocAccess({ module: moduleSlug, slug, file }, { superAdminOnly: true });
  if (!access.ok) return access.response;

  const form = await request.formData();
  const uploadFile = form.get("file");
  if (!isUploadedFile(uploadFile)) return jsonError(400, "差し替えられませんでした（ファイルを選んでください）");
  if (uploadFile.size <= 0) return jsonError(400, "差し替えられませんでした（空のファイルは使えません）");
  if (uploadFile.size > MAX_UPLOAD_SIZE) return jsonError(400, "差し替えられませんでした（5MB までです）");
  if (!hasExpectedExtension(uploadFile.name, access.doc.file)) {
    return jsonError(400, "差し替えられませんでした（ファイルの種類が違います）");
  }

  const admin = getManualAdmin();
  const bucket = admin.storage.from(MANUAL_BUCKET);
  const currentPath = currentStoragePath(access.manual, access.doc);
  const archivePath = archivedStoragePath(access.manual, access.doc, timestampForVersion());

  const { data: currentBlob } = await bucket.download(currentPath);
  if (currentBlob) {
    const { error: copyError } = await bucket.copy(currentPath, archivePath);
    if (copyError) return jsonError(500, "差し替えられませんでした（今の版を履歴に残せませんでした）");
    await insertVersionRecord({
      module: access.manual.moduleSlug,
      slug: access.manual.slug,
      file: access.doc.file,
      storagePath: archivePath,
      size: currentBlob.size,
      uploadedBy: access.user.name,
      note: "差し替え前の版",
    });
  }

  const { error: uploadError } = await bucket.upload(currentPath, await uploadFile.arrayBuffer(), {
    contentType: contentTypeForDoc(access.doc),
    upsert: true,
  });
  if (uploadError) return jsonError(500, "差し替えられませんでした（保存できませんでした）");

  const version = await insertVersionRecord({
    module: access.manual.moduleSlug,
    slug: access.manual.slug,
    file: access.doc.file,
    storagePath: currentPath,
    size: uploadFile.size,
    uploadedBy: access.user.name,
    note: "いま表示中",
  });

  return NextResponse.json({ ok: true, version }, { headers: MANUAL_SECURITY_HEADERS });
}
