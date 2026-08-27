import {
  findOrCreateSubfolder,
  folderHasFile,
  uploadToFolder,
} from "@/app/api/bud/expense-drive/_lib/drive";
type DriveResult = {
  status: "generated" | "skipped" | "failed";
  fileId: string | null;
  url: string | null;
  note: string | null;
};
const jstParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}${get("month")}${get("day")}`,
    time: `${get("hour")}${get("minute")}${get("second")}`,
  };
};
export function todokeFilename(
  now = new Date(),
  withSeconds = false,
) {
  const p = jstParts(now);
  return `緊急連絡先届_${p.date}${withSeconds ? `_${p.time}` : ""}.pdf`;
}
export function employeeTodokeFolderName(employeeNumber: string, employeeName: string) {
  return `${employeeNumber}_${employeeName.replace(/[\s　]+/g, "")}`;
}
export async function saveTodokePdf(
  buffer: Buffer,
  employeeNumber: string,
  employeeName: string,
  now = new Date(),
): Promise<DriveResult> {
  const root = process.env.GARDEN_TODOKE_DRIVE_ROOT_FOLDER_ID;
  if (!root)
    return {
      status: "skipped",
      fileId: null,
      url: null,
      note: "届出PDF保存先が未設定のためスキップ",
    };
  try {
    const folder = await findOrCreateSubfolder(
      root,
      employeeTodokeFolderName(employeeNumber, employeeName),
    );
    let filename = todokeFilename(now);
    if (await folderHasFile(folder, filename))
      filename = todokeFilename(now, true);
    const result = await uploadToFolder(
      folder,
      filename,
      buffer,
      "application/pdf",
    );
    return {
      status: "generated",
      fileId: result.id,
      url: result.webViewLink,
      note: null,
    };
  } catch (error) {
    return {
      status: "failed",
      fileId: null,
      url: null,
      note: `届出PDF生成・保存失敗: ${error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200)}`,
    };
  }
}
