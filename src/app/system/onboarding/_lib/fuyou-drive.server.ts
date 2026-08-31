import "server-only";
import { uploadToFolder } from "@/app/api/bud/expense-drive/_lib/drive";

export const FUYOU_DRIVE_FOLDER_ID = "1O8A_4NEZFdXWDgV06MDTYCJ6qZblk6AV";
export const FUYOU_DRIVE_FOLDER_LABEL = "経理部 ／ 12_扶養控除申告書";

type DriveUploader = typeof uploadToFolder;

export async function saveFuyouPdfToDrive(
  filename: string,
  content: Buffer,
  uploader: DriveUploader = uploadToFolder,
) {
  const folderId = process.env.GARDEN_FUYOU_DRIVE_FOLDER_ID || FUYOU_DRIVE_FOLDER_ID;
  const uploaded = await uploader(folderId, filename, content, "application/pdf");
  return {
    fileId: uploaded.id,
    url: uploaded.webViewLink,
    filename,
    folderLabel: FUYOU_DRIVE_FOLDER_LABEL,
  };
}
