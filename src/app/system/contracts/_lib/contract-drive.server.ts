import {
  findOrCreateSubfolder,
  folderHasFile,
  getDriveFolderMetadata,
  uploadToFolder,
} from "@/app/api/bud/expense-drive/_lib/drive";
import { companyAbbreviation } from "./contract-types";
const DRIVE_FOLDER = "application/vnd.google-apps.folder";
export type ContractDriveBreadcrumb = { id: string | null; name: string };

export async function getContractDriveBreadcrumbs(
  folderId: string,
  rootId: string,
): Promise<ContractDriveBreadcrumb[]> {
  const path: ContractDriveBreadcrumb[] = [];
  const visited = new Set<string>();
  let currentId = folderId;

  while (currentId !== rootId) {
    if (visited.has(currentId)) throw new Error("Drive folder hierarchy contains a cycle");
    visited.add(currentId);
    const folder = await getDriveFolderMetadata(currentId);
    if (folder.mimeType !== DRIVE_FOLDER || !folder.parents[0])
      throw new Error("Drive folder is outside the contracts root");
    path.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parents[0];
  }

  return [{ id: null, name: "契約書" }, ...path];
}
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
  const match = name.match(/^(.*?)(\.[^.]+)?$/);
  return `${match?.[1] ?? name}_${suffix(now)}${match?.[2] ?? ""}`;
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
  files: { pdf: Buffer; docx: Buffer },
  filenames: { pdf: string; docx: string },
  product: string,
  counterparty: string,
  now = new Date(),
) {
  const root = process.env.GARDEN_CONTRACTS_DRIVE_ROOT_FOLDER_ID;
  if (!root) return { status: "skipped" as const, pdf: null, docx: null };
  const top = await findOrCreateSubfolder(root, "05_パートナー配布用ひな形"),
    productFolder = await findOrCreateSubfolder(top, safe(product)),
    folder = await findOrCreateSubfolder(productFolder, safe(counterparty)),
    pdfName = await unique(folder, safe(filenames.pdf), now),
    docxName = await unique(folder, safe(filenames.docx), now),
    pdf = await uploadToFolder(folder, pdfName, files.pdf, "application/pdf"),
    docx = await uploadToFolder(folder, docxName, files.docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  return {
    status: "generated" as const,
    pdf: { fileId: pdf.id, url: pdf.webViewLink },
    docx: { fileId: docx.id, url: docx.webViewLink },
  };
}
