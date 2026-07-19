import { NextRequest } from "next/server";
import { getIntakeSource } from "@/app/rill/mail/_lib/graph";
import { intakeStoragePath, isDuplicateIntakeError, isIntakeKind, type IntakeItem } from "@/app/rill/mail/_lib/intake";
import { bestEffortIntakeDriveMirror } from "@/app/rill/mail/_lib/intake-drive";
import { ensureRillTransferInbox, type RillTransferInboxSource } from "@/app/api/bud/transfer-inbox/_lib/import-from-rill";
import { errorResponse, requireGardenUser, RillMailHttpError } from "@/app/rill/mail/_lib/server-auth";

const ITEM_SELECT = "id,kind,attachment_id,created_by_name,created_at,notice_text,file_name,mime,storage_path,message_id,mail_subject,mail_from_name,mail_from_address,mail_received_at";
type IntakeItemRow = Omit<IntakeItem, "notice_saved"> & {
  notice_text: string | null;
  file_name: string;
  mime: string;
  storage_path: string;
  message_id: string;
  mail_subject: string;
  mail_from_name: string;
  mail_from_address: string;
  mail_received_at: string;
};

function toIntakeItem(row: IntakeItemRow): IntakeItem {
  return {
    id: row.id,
    kind: row.kind,
    attachment_id: row.attachment_id,
    created_by_name: row.created_by_name,
    created_at: row.created_at,
    notice_saved: Boolean(row.notice_text?.trim()),
  };
}

function toTransferSource(row: IntakeItemRow): RillTransferInboxSource {
  return {
    intakeId: row.id,
    fileName: row.file_name,
    mimeType: row.mime,
    importedAt: row.mail_received_at,
    messageId: row.message_id,
    attachmentId: row.attachment_id,
    fromName: row.mail_from_name,
    fromAddress: row.mail_from_address,
    subject: row.mail_subject,
    storagePath: row.storage_path,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireGardenUser();
    const box = request.nextUrl.searchParams.get("box")?.trim();
    const messageId = request.nextUrl.searchParams.get("messageId")?.trim();
    if (!box || !messageId) throw new RillMailHttpError(400, "box and messageId are required");
    const { data, error } = await supabase.from("garden_intake_items").select(ITEM_SELECT).eq("box_address", box).eq("message_id", messageId).order("created_at", { ascending: false });
    if (error) throw new RillMailHttpError(500, error.message);
    return Response.json({ items: ((data ?? []) as IntakeItemRow[]).map(toIntakeItem) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireGardenUser();
    const body = await request.json() as { box?: unknown; messageId?: unknown; attachmentId?: unknown; kind?: unknown };
    const box = typeof body.box === "string" ? body.box.trim() : "";
    const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
    const attachmentId = typeof body.attachmentId === "string" ? body.attachmentId.trim() : "";
    if (!box || !messageId || !attachmentId) throw new RillMailHttpError(400, "box, messageId and attachmentId are required");
    if (!isIntakeKind(body.kind)) throw new RillMailHttpError(400, "Invalid intake kind");

    const existingQuery = () => supabase.from("garden_intake_items").select(ITEM_SELECT).eq("box_address", box).eq("message_id", messageId).eq("attachment_id", attachmentId).maybeSingle<IntakeItemRow>();
    const existing = await existingQuery();
    if (existing.error) throw new RillMailHttpError(500, existing.error.message);
    if (existing.data) {
      if (existing.data.kind === "請求") await ensureRillTransferInbox(toTransferSource(existing.data));
      return Response.json({ item: toIntakeItem(existing.data) }, { status: 409 });
    }

    const source = await getIntakeSource(supabase, user, box, messageId, attachmentId);
    const id = crypto.randomUUID();
    const storagePath = intakeStoragePath(body.kind, new Date(), id, source.attachment.name);
    const { error: uploadError } = await supabase.storage.from("garden-intake").upload(storagePath, source.attachment.bytes, { contentType: source.attachment.contentType, upsert: false });
    if (uploadError) throw new RillMailHttpError(500, uploadError.message);

    const { data, error } = await supabase.from("garden_intake_items").insert({
      id,
      kind: body.kind,
      box_address: source.boxAddress,
      message_id: messageId,
      attachment_id: attachmentId,
      file_name: source.attachment.name,
      mime: source.attachment.contentType,
      size_bytes: source.attachment.size,
      storage_path: storagePath,
      mail_subject: source.message.subject,
      mail_from_name: source.message.fromName,
      mail_from_address: source.message.fromAddress,
      mail_received_at: source.message.receivedDateTime,
      created_by: user.id,
      created_by_name: source.createdByName,
    }).select(ITEM_SELECT).single<IntakeItemRow>();

    if (error) {
      await supabase.storage.from("garden-intake").remove([storagePath]);
      if (isDuplicateIntakeError(error)) {
        const duplicate = await existingQuery();
        if (duplicate.data) {
          if (duplicate.data.kind === "請求") await ensureRillTransferInbox(toTransferSource(duplicate.data));
          return Response.json({ item: toIntakeItem(duplicate.data) }, { status: 409 });
        }
      }
      throw new RillMailHttpError(500, error.message);
    }
    const driveFileId = await bestEffortIntakeDriveMirror({
      kind: body.kind,
      receivedAt: source.message.receivedDateTime,
      fromName: source.message.fromName,
      fromAddress: source.message.fromAddress,
      subject: source.message.subject,
      originalFileName: source.attachment.name,
      attachmentIndex: source.attachment.index,
      bytes: source.attachment.bytes,
      mimeType: source.attachment.contentType,
    });
    if (driveFileId) {
      try {
        const { error: driveIdError } = await supabase
          .from("garden_intake_items")
          .update({ drive_file_id: driveFileId })
          .eq("id", id);
        if (driveIdError) console.error("Rill Mail intake drive_file_id update failed", driveIdError.message);
      } catch (driveIdError) {
        console.error("Rill Mail intake drive_file_id update failed", driveIdError instanceof Error ? driveIdError.message : driveIdError);
      }
    }
    if (data.kind === "請求") await ensureRillTransferInbox(toTransferSource(data), source.attachment.bytes);
    return Response.json({ item: toIntakeItem(data) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
