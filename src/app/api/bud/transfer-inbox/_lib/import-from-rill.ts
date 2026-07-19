import { getSupabaseAdmin } from "@/lib/supabase/admin";

const SOURCE_BUCKET = "garden-intake";
const TARGET_BUCKET = "bud-attachments";

export type RillTransferInboxSource = {
  intakeId: string;
  fileName: string;
  mimeType: string;
  importedAt: string;
  messageId: string;
  attachmentId: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  storagePath: string;
};

export function rillTransferDriveFileId(intakeId: string) {
  return `rill:${intakeId}`;
}

export function rillTransferStoragePath(intakeId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "attachment";
  return `transfer-inbox/rill/${intakeId}/${safeName}`;
}

export function buildRillTransferInboxRow(source: RillTransferInboxSource, targetPath: string, publicUrl: string) {
  const address = source.fromAddress.trim();
  const name = source.fromName.trim();
  const from = name && address ? `${name} <${address}>` : name || address || null;
  return {
    drive_file_id: rillTransferDriveFileId(source.intakeId),
    file_name: source.fileName,
    mime_type: source.mimeType,
    storage_path: targetPath,
    public_url: publicUrl,
    imported_at: source.importedAt,
    status: "pending",
    source: "rill",
    mail_meta: {
      message_id: source.messageId,
      attachment_id: source.attachmentId,
      from,
      subject: source.subject || null,
      received_at: source.importedAt,
      garden_intake_id: source.intakeId,
    },
  };
}

export async function ensureRillTransferInbox(source: RillTransferInboxSource, bytes?: Buffer) {
  const supabase = getSupabaseAdmin();
  const driveFileId = rillTransferDriveFileId(source.intakeId);
  const { data: existing, error: existingError } = await supabase
    .from("bud_transfer_inbox").select("id").eq("drive_file_id", driveFileId).maybeSingle<{ id: string }>();
  if (existingError) throw existingError;
  if (existing) return { status: "skipped" as const, id: existing.id };

  let content = bytes;
  if (!content) {
    const { data, error } = await supabase.storage.from(SOURCE_BUCKET).download(source.storagePath);
    if (error) throw error;
    content = Buffer.from(await data.arrayBuffer());
  }

  const targetPath = rillTransferStoragePath(source.intakeId, source.fileName);
  const { error: uploadError } = await supabase.storage.from(TARGET_BUCKET).upload(targetPath, content, {
    contentType: source.mimeType,
    upsert: true,
  });
  if (uploadError) throw uploadError;
  const { data: publicData } = supabase.storage.from(TARGET_BUCKET).getPublicUrl(targetPath);
  const { data, error: insertError } = await supabase.from("bud_transfer_inbox")
    .insert(buildRillTransferInboxRow(source, targetPath, publicData.publicUrl)).select("id").single<{ id: string }>();
  if (!insertError) return { status: "imported" as const, id: data.id };

  const { data: raced } = await supabase.from("bud_transfer_inbox")
    .select("id").eq("drive_file_id", driveFileId).maybeSingle<{ id: string }>();
  if (raced) return { status: "skipped" as const, id: raced.id };
  await supabase.storage.from(TARGET_BUCKET).remove([targetPath]);
  throw insertError;
}
