import { supabase } from "../../_lib/supabase";

export interface UploadResult {
  success: boolean;
  path?: string;
  publicUrl?: string;
  error?: string;
}

const BUCKET = "bud-attachments";

export async function uploadAttachment(
  file: File,
  transferIdHint: string,
): Promise<UploadResult> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${transferIdHint}/${timestamp}_${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false });

  if (error) {
    return { success: false, error: error.message };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { success: true, path, publicUrl: data.publicUrl };
}

export async function removeAttachment(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}
