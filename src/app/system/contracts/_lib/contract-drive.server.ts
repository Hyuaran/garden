import {
  findOrCreateSubfolder,
  folderHasFile,
  uploadToFolder,
} from "@/app/api/bud/expense-drive/_lib/drive";
import { companyAbbreviation } from "./contract-types";
const safe = (v: string) => v.replace(/[\\/:*?"<>|]/g, "_").trim();
const suffix = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(d)
    .filter((p) => p.type !== "literal")
    .map((p) => p.value)
    .join("");
async function unique(folder: string, name: string, now: Date) {
  if (!(await folderHasFile(folder, name))) return name;
  const dot = name.toLowerCase().endsWith(".pdf") ? name.slice(0, -4) : name;
  return `${dot}_${suffix(now)}.pdf`;
}
export async function saveOriginalContract(
  buffer: Buffer,
  filename: string,
  counterparty: string,
  companyId: string,
  now = new Date(),
) {
  const root = process.env.GARDEN_CONTRACTS_DRIVE_ROOT_FOLDER_ID,
    folderName = `${safe(counterparty)}_${companyAbbreviation(companyId)}`;
  if (!root)
    return { status: "skipped" as const, fileId: null, url: null, folderName };
  const top = await findOrCreateSubfolder(root, "01_契約書　上位店"),
    folder = await findOrCreateSubfolder(top, folderName),
    name = await unique(folder, safe(filename), now),
    uploaded = await uploadToFolder(folder, name, buffer, "application/pdf");
  return {
    status: "generated" as const,
    fileId: uploaded.id,
    url: uploaded.webViewLink,
    folderName,
  };
}
export async function savePartnerTemplate(
  buffer: Buffer,
  filename: string,
  product: string,
  now = new Date(),
) {
  const root = process.env.GARDEN_CONTRACTS_DRIVE_ROOT_FOLDER_ID;
  if (!root) return { status: "skipped" as const, fileId: null, url: null };
  const top = await findOrCreateSubfolder(root, "05_パートナー配布用ひな形"),
    folder = await findOrCreateSubfolder(top, safe(product)),
    name = await unique(folder, safe(filename), now),
    uploaded = await uploadToFolder(folder, name, buffer, "application/pdf");
  return {
    status: "generated" as const,
    fileId: uploaded.id,
    url: uploaded.webViewLink,
  };
}
