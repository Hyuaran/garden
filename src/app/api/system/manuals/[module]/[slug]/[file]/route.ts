import {
  contentTypeForDoc,
  currentStoragePath,
  jsonError,
  MANUAL_BUCKET,
  MANUAL_SECURITY_HEADERS,
  getManualAdmin,
  requireManualDocAccess,
} from "@/app/api/system/manuals/_lib/manuals-api";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ module: string; slug: string; file: string }> },
) {
  const { module: moduleSlug, slug, file } = await params;
  const access = await requireManualDocAccess({ module: moduleSlug, slug, file });
  if (!access.ok) return access.response;

  const admin = getManualAdmin();
  const { data, error } = await admin
    .storage
    .from(MANUAL_BUCKET)
    .download(currentStoragePath(access.manual, access.doc));
  if (error || !data) {
    if (access.doc.kind === "html") {
      const notice = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>body{margin:0;font-family:"Meiryo","Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,sans-serif;color:#5a6b80;background:#f4f5f7;padding:40px 24px;text-align:center;font-size:15px}</style></head><body>この資料はまだ登録されていません。管理者へお問い合わせください。</body></html>';
      return new Response(notice, { status: 404, headers: { ...MANUAL_SECURITY_HEADERS, "Content-Type": "text/html; charset=utf-8" } });
    }
    return jsonError(404, "manual not found");
  }

  return new Response(await data.arrayBuffer(), {
    headers: {
      ...MANUAL_SECURITY_HEADERS,
      "Content-Type": contentTypeForDoc(access.doc),
    },
  });
}
