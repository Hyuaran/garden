import "server-only";
import { uploadToFolder } from "@/app/api/bud/expense-drive/_lib/drive";

export const RENRAKUHYO_DRIVE_FOLDER_ID = "1-B5jfLwcfOquXybmyk9UQhTvgfAM442-";
export const RENRAKUHYO_DRIVE_FOLDER_LABEL = "経理部 ／ 30_入社連絡票";

type DriveUploader = typeof uploadToFolder;

export async function saveRenrakuhyoToDrive(
  files: { xlsx: { filename: string; content: Buffer }; pdf: { filename: string; content: Buffer } },
  uploader: DriveUploader = uploadToFolder,
) {
  const folderId = process.env.GARDEN_RENRAKUHYO_DRIVE_FOLDER_ID || RENRAKUHYO_DRIVE_FOLDER_ID;
  const [xlsx, pdf] = await Promise.all([
    uploader(folderId, files.xlsx.filename, files.xlsx.content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    uploader(folderId, files.pdf.filename, files.pdf.content, "application/pdf"),
  ]);
  return {
    xlsxFileId: xlsx.id,
    pdfFileId: pdf.id,
    xlsxUrl: xlsx.webViewLink,
    pdfUrl: pdf.webViewLink,
    xlsxFilename: files.xlsx.filename,
    pdfFilename: files.pdf.filename,
    folderLabel: RENRAKUHYO_DRIVE_FOLDER_LABEL,
  };
}
