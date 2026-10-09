import { listDriveFolderEntries, type DriveBrowserEntry } from "@/app/api/bud/expense-drive/_lib/drive";

const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveLister = (folderId: string) => Promise<DriveBrowserEntry[]>;

export type DriveMatchInput = {
  rootFolderId: string;
  vendor: string;
  periodMonth: string;
  listEntries?: DriveLister;
};

export type DriveMatchResult =
  | { status: "matched"; url: string; file: DriveBrowserEntry; note: string }
  | { status: "none" | "multiple"; note: string; candidates: DriveBrowserEntry[] };

export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function monthPatterns(periodMonth: string): string[] {
  const [year, month] = periodMonth.split("-");
  return [`${year}.${month}`, `${year}${month}`, `${year}年${month}月`].map(normalizeForMatch);
}

function driveFileUrl(file: DriveBrowserEntry): string {
  return file.webViewLink || `https://drive.google.com/file/d/${file.id}/view?usp=sharing`;
}

export function matchInvoiceFiles(files: DriveBrowserEntry[], vendor: string, periodMonth: string): DriveMatchResult {
  const normalizedVendor = normalizeForMatch(vendor);
  const patterns = monthPatterns(periodMonth);
  const candidates = files.filter((file) => {
    const name = normalizeForMatch(file.name);
    return name.includes(normalizedVendor) && patterns.some((pattern) => name.includes(pattern));
  });

  if (candidates.length === 1) {
    return {
      status: "matched",
      url: driveFileUrl(candidates[0]),
      file: candidates[0],
      note: "請求書を見つけました",
    };
  }
  if (candidates.length === 0) return { status: "none", note: "請求書が見つかりません", candidates };
  return { status: "multiple", note: "請求書の候補が複数あります", candidates };
}

export async function findInvoiceFile(input: DriveMatchInput): Promise<DriveMatchResult> {
  const listEntries = input.listEntries ?? listDriveFolderEntries;
  const rootEntries = await listEntries(input.rootFolderId);
  const fiscalFolders = rootEntries.filter(
    (entry) => entry.mimeType === FOLDER_MIME && entry.name.includes("【決算第"),
  );
  const targetFolderName = normalizeForMatch(input.periodMonth.replace("-", "年") + "月");
  const files: DriveBrowserEntry[] = [];

  for (const fiscalFolder of fiscalFolders) {
    const monthFolders = (await listEntries(fiscalFolder.id)).filter(
      (entry) => entry.mimeType === FOLDER_MIME && normalizeForMatch(entry.name) === targetFolderName,
    );
    for (const monthFolder of monthFolders) {
      files.push(...(await listEntries(monthFolder.id)).filter((entry) => entry.mimeType !== FOLDER_MIME));
    }
  }

  return matchInvoiceFiles(files, input.vendor, input.periodMonth);
}
