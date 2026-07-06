import {
  downloadFile,
  listFolderFiles,
  type DriveFolderFile,
} from "@/app/api/bud/expense-drive/_lib/drive";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "bud-attachments";

export type TransferInboxImportResult = {
  driveFileId: string;
  fileName: string;
  status: "imported" | "skipped" | "failed";
  error?: string;
};

export type TransferInboxImportSummary = {
  ok: true;
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  results: TransferInboxImportResult[];
};

export async function importTransferInboxFromDrive(folderId: string): Promise<TransferInboxImportSummary> {
  const supabase = getSupabaseAdmin();
  const files = await listFolderFiles(folderId);
  const results: TransferInboxImportResult[] = [];

  for (const file of files) {
    try {
      const { data: existing, error: existingError } = await supabase
        .from("bud_transfer_inbox")
        .select("id")
        .eq("drive_file_id", file.id)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) {
        results.push({
          driveFileId: file.id,
          fileName: file.name,
          status: "skipped",
        });
        continue;
      }

      const buffer = await downloadFile(file.id);
      const storagePath = buildStoragePath(file);
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: file.mimeType,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

      const { error: insertError } = await supabase
        .from("bud_transfer_inbox")
        .insert({
          drive_file_id: file.id,
          file_name: file.name,
          mime_type: file.mimeType,
          storage_path: storagePath,
          public_url: publicData.publicUrl,
          imported_at: file.createdTime ?? new Date().toISOString(),
          status: "pending",
        });
      if (insertError) throw insertError;

      results.push({
        driveFileId: file.id,
        fileName: file.name,
        status: "imported",
      });
    } catch (error) {
      results.push({
        driveFileId: file.id,
        fileName: file.name,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ok: true,
    total: files.length,
    imported: results.filter((result) => result.status === "imported").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}

function buildStoragePath(file: DriveFolderFile) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `transfer-inbox/${file.id}/${Date.now()}_${safeName}`;
}
