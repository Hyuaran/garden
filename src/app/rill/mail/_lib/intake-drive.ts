import {
  findOrCreateAppFolder,
  findOrCreateSubfolder,
  uploadToFolder,
} from "@/app/api/bud/expense-drive/_lib/drive";
import type { IntakeKind } from "./intake";

const ROOT_FOLDER_NAME = "Garden_取込トレイ";
const ROOT_MARKER = { key: "gardenPurpose", value: "rillMailIntakeMirror" } as const;
const KIND_FOLDER_NAMES: Record<IntakeKind, string> = {
  請求: "請求",
  入金: "入金",
  条件: "条件",
  周知: "周知",
};

export type IntakeDriveMirrorInput = {
  kind: IntakeKind;
  receivedAt: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  originalFileName: string;
  attachmentIndex: number;
  bytes: Buffer;
  mimeType: string;
};

export type IntakeDriveClient = {
  findOrCreateAppFolder: typeof findOrCreateAppFolder;
  findOrCreateSubfolder: typeof findOrCreateSubfolder;
  uploadToFolder: typeof uploadToFolder;
};

const defaultClient: IntakeDriveClient = {
  findOrCreateAppFolder,
  findOrCreateSubfolder,
  uploadToFolder,
};

function validDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid intake received date");
  return date;
}

function cleanFilePart(value: string, fallback: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|\r\n]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

export function intakeDriveFolderPath(kind: IntakeKind, receivedAt: string) {
  const date = validDate(receivedAt);
  const folder = KIND_FOLDER_NAMES[kind];
  if (!folder) throw new Error("Invalid intake kind");
  const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return { root: ROOT_FOLDER_NAME, kind: folder, month };
}

export function intakeDriveFileName(input: Omit<IntakeDriveMirrorInput, "bytes" | "mimeType" | "kind">) {
  const date = validDate(input.receivedAt);
  const received = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  const addressLocalPart = input.fromAddress.split("@")[0] ?? "";
  const sender = cleanFilePart(input.fromName || addressLocalPart, "差出人不明");
  const subject = cleanFilePart(Array.from(input.subject).slice(0, 20).join(""), "無題");
  const extension = (/\.[A-Za-z0-9]{1,10}$/.exec(input.originalFileName)?.[0] ?? "").toLowerCase();
  const suffix = input.attachmentIndex > 1 ? `_${input.attachmentIndex}` : "";
  return `${received}_${sender}_${subject}${suffix}${extension}`;
}

export async function mirrorIntakeToDrive(
  input: IntakeDriveMirrorInput,
  client: IntakeDriveClient = defaultClient,
) {
  const path = intakeDriveFolderPath(input.kind, input.receivedAt);
  const rootId = await client.findOrCreateAppFolder(path.root, ROOT_MARKER);
  const kindId = await client.findOrCreateSubfolder(rootId, path.kind);
  const monthId = await client.findOrCreateSubfolder(kindId, path.month);
  const uploaded = await client.uploadToFolder(
    monthId,
    intakeDriveFileName(input),
    input.bytes,
    input.mimeType,
  );
  return uploaded.id;
}

export async function bestEffortIntakeDriveMirror(
  input: IntakeDriveMirrorInput,
  client: IntakeDriveClient = defaultClient,
) {
  try {
    return await mirrorIntakeToDrive(input, client);
  } catch (error) {
    console.error("Rill Mail intake Drive mirror failed", error instanceof Error ? error.message : error);
    return null;
  }
}
