import { uploadToFolder } from "@/app/api/bud/expense-drive/_lib/drive";
import { intakeDriveFileName, resolveIntakeDriveFolder } from "@/app/rill/mail/_lib/intake-drive";
import { assertNoticeKind, decodeNoticePng, limitNoticePages, noticeDriveNames, noticeStoragePath } from "@/app/rill/mail/_lib/intake-notice";
import { errorResponse, requireGardenUser, RillMailHttpError } from "@/app/rill/mail/_lib/server-auth";

type IntakeRow = {
  id: string; kind: string; notice_text: string | null; mail_received_at: string; mail_from_name: string;
  mail_from_address: string; mail_subject: string; file_name: string; created_by: string;
};

const SELECT = "id,kind,notice_text,mail_received_at,mail_from_name,mail_from_address,mail_subject,file_name,created_by";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireGardenUser();
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!id) throw new RillMailHttpError(400, "id is required");
    const row = await noticeRow(supabase, id);
    const prefix = `shuchi/${new Date(row.mail_received_at).getUTCFullYear()}/${String(new Date(row.mail_received_at).getUTCMonth() + 1).padStart(2, "0")}/${id}_p`;
    const { data: files, error } = await supabase.storage.from("garden-intake").list(prefix.slice(0, prefix.lastIndexOf("/")), { search: `${id}_p`, sortBy: { column: "name", order: "asc" } });
    if (error) throw new RillMailHttpError(500, error.message);
    const paths = (files ?? []).filter((file) => new RegExp(`^${id}_p\\d+\\.png$`).test(file.name)).map((file) => `${prefix.slice(0, prefix.lastIndexOf("/") + 1)}${file.name}`);
    const signed = await Promise.all(paths.map(async (path) => {
      const { data, error: signError } = await supabase.storage.from("garden-intake").createSignedUrl(path, 900);
      if (signError) throw new RillMailHttpError(500, signError.message);
      return { path, url: data.signedUrl };
    }));
    return Response.json({ noticeText: row.notice_text ?? "", images: signed });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireGardenUser();
    const body = await request.json() as { intakeId?: unknown; noticeText?: unknown; pages?: unknown };
    const intakeId = typeof body.intakeId === "string" ? body.intakeId : "";
    const noticeText = typeof body.noticeText === "string" ? body.noticeText.trim() : "";
    if (!intakeId || !noticeText) throw new RillMailHttpError(400, "intakeId and noticeText are required");
    const { pages, truncated } = limitNoticePages(body.pages);
    if (!pages.length) throw new RillMailHttpError(400, "PNG pages are required");
    const row = await noticeRow(supabase, intakeId);
    try { assertNoticeKind(row.kind); }
    catch { throw new RillMailHttpError(400, "Only 周知 intake is supported"); }
    if (row.created_by !== user.id) throw new RillMailHttpError(403, "Only the creator can save this notice");
    const paths = pages.map((_, index) => noticeStoragePath(intakeId, row.mail_received_at, index + 1));
    for (let index = 0; index < pages.length; index += 1) {
      const { error } = await supabase.storage.from("garden-intake").upload(paths[index], decodeNoticePng(pages[index].base64), { contentType: "image/png", upsert: true });
      if (error) throw new RillMailHttpError(500, error.message);
    }
    const { error: updateError } = await supabase.from("garden_intake_items").update({ notice_text: noticeText }).eq("id", intakeId);
    if (updateError) throw new RillMailHttpError(500, updateError.message);
    await mirrorNotice(row, pages.map((page) => decodeNoticePng(page.base64)), noticeText);
    return Response.json({ ok: true, truncated, imagePaths: paths });
  } catch (error) { return errorResponse(error); }
}

async function noticeRow(supabase: Awaited<ReturnType<typeof requireGardenUser>>["supabase"], id: string) {
  const { data, error } = await supabase.from("garden_intake_items").select(SELECT).eq("id", id).maybeSingle<IntakeRow>();
  if (error) throw new RillMailHttpError(500, error.message);
  if (!data) throw new RillMailHttpError(404, "Intake item not found");
  return data;
}

async function mirrorNotice(row: IntakeRow, pages: Buffer[], text: string) {
  try {
    const folderId = await resolveIntakeDriveFolder("周知", row.mail_received_at);
    const baseName = intakeDriveFileName({ receivedAt: row.mail_received_at, fromName: row.mail_from_name, fromAddress: row.mail_from_address, subject: row.mail_subject, originalFileName: row.file_name, attachmentIndex: 1 });
    const names = noticeDriveNames(baseName, pages.length);
    await Promise.all([
      ...pages.map((page, index) => uploadToFolder(folderId, names.pages[index], page, "image/png")),
      uploadToFolder(folderId, names.text, Buffer.from(text, "utf8"), "text/plain; charset=utf-8"),
    ]);
  } catch (error) { console.error("Rill Mail notice Drive mirror failed", error instanceof Error ? error.message : error); }
}
