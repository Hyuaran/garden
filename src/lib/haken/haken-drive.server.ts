import {
  findOrCreateSubfolder,
  folderHasFile,
  listDriveFolderEntries,
  uploadToFolder,
} from "@/app/api/bud/expense-drive/_lib/drive";
import { MAX_CONTRACT_SIZE } from "@/app/system/contracts/_lib/contract-types";

export function validateHakenPdf(
  buffer: Buffer,
  filename: string,
  mime: string,
) {
  if (
    mime !== "application/pdf" ||
    !filename.toLowerCase().endsWith(".pdf") ||
    buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
  )
    throw new Error("PDF のみ追加できます。");
  if (buffer.length > MAX_CONTRACT_SIZE)
    throw new Error("PDF は20MBまでです。");
}
export async function saveHakenPdf(
  buffer: Buffer,
  filename: string,
  company: string,
) {
  validateHakenPdf(buffer, filename, "application/pdf");
  const root = process.env.GARDEN_HAKEN_DRIVE_ROOT_FOLDER_ID;
  if (!root)
    throw new Error(
      "書類の保存先が設定されていないため、保存できませんでした。",
    );
  const safe = (value: string) => value.replace(/[\\/:*?"<>|]/g, "_").trim();
  const top = await findOrCreateSubfolder(root, "03_派遣先として受入");
  // 既存の「01_株式会社エモーション」のような番号つきフォルダがあれば、そこへ入れる。
  const companyName = safe(company);
  const existing = (await listDriveFolderEntries(top)).find(
    (entry) =>
      entry.mimeType === "application/vnd.google-apps.folder" &&
      (entry.name === companyName ||
        entry.name.replace(/^\d+_/, "") === companyName),
  );
  const folder = existing?.id ?? (await findOrCreateSubfolder(top, companyName));
  let name = safe(filename);
  if (await folderHasFile(folder, name))
    name = name.replace(
      /\.pdf$/i,
      `_${new Date().toISOString().replace(/\D/g, "")}.pdf`,
    );
  const file = await uploadToFolder(folder, name, buffer, "application/pdf");
  return { fileId: file.id, url: file.webViewLink };
}
