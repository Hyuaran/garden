/**
 * 予約（Kintone 振込依頼）と保存（Google Drive）を業者ごとにまとめて引く。読むだけ。
 */
import { getDriveAccessToken } from "@/app/api/bud/expense-drive/_lib/drive";
import { getAllRecords, type KintoneRecord } from "@/lib/kintone/records";

import { addDays } from "@/lib/pl-payments/business-day";

import { DRIVE_ROOT_IDS, type Vendor } from "./vendors";

export type Reservation = { id: string; dueDate: string; amount: number | null };
export type SavedFile = { id: string; name: string; createdAt: string; url: string };

export type Lookups = {
  reservations(vendor: Vendor): Promise<Reservation[]>;
  savedFiles(vendor: Vendor): Promise<SavedFile[]>;
};

function q(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function field(record: KintoneRecord, code: string): string {
  const cell = record[code] as { value?: unknown } | undefined;
  return cell?.value == null ? "" : String(cell.value);
}

export class LiveLookups implements Lookups {
  private readonly reservationCache = new Map<string, Promise<Reservation[]>>();
  private readonly fileCache = new Map<string, Promise<SavedFile[]>>();
  private readonly parentCache = new Map<string, Promise<string[]>>();
  private tokenPromise: Promise<string> | null = null;

  constructor(private readonly today: string) {}

  reservations(vendor: Vendor): Promise<Reservation[]> {
    const cached = this.reservationCache.get(vendor.kintoneName);
    if (cached) return cached;
    const promise = this.loadReservations(vendor.kintoneName);
    this.reservationCache.set(vendor.kintoneName, promise);
    return promise;
  }

  savedFiles(vendor: Vendor): Promise<SavedFile[]> {
    const key = `${vendor.driveRoot}:${vendor.driveName}`;
    const cached = this.fileCache.get(key);
    if (cached) return cached;
    const promise = this.loadFiles(vendor);
    this.fileCache.set(key, promise);
    return promise;
  }

  private async loadReservations(name: string): Promise<Reservation[]> {
    const app = process.env.KINTONE_TRANSFER_REQUEST_APP_ID || "51";
    const token = process.env.KINTONE_TRANSFER_REQUEST_TOKEN;
    if (!token) throw new Error("KINTONE_TRANSFER_REQUEST_TOKEN が設定されていません");
    // 文字列__1行__0＝お支払い先／日付_0＝支払期日／数値＝金額
    const condition = `文字列__1行__0 like "${q(name)}" and 日付_0 >= "${addDays(this.today, -150)}" and 日付_0 <= "${addDays(this.today, 150)}"`;
    const records = await getAllRecords(app, token, condition, ["$id", "日付_0", "数値"]);
    return records.map((record) => ({
      id: field(record, "$id"),
      dueDate: field(record, "日付_0"),
      amount: field(record, "数値") === "" ? null : Number(field(record, "数値")),
    }));
  }

  private token(): Promise<string> {
    this.tokenPromise ??= getDriveAccessToken();
    return this.tokenPromise;
  }

  private async driveGet<T>(path: string): Promise<T> {
    const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
      headers: { Authorization: `Bearer ${await this.token()}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Google Drive を読めません（${response.status}）`);
    return (await response.json()) as T;
  }

  /** 親フォルダをたどって、保存先（02_支払 明細 など）の中にあるかを確かめる */
  private parents(id: string): Promise<string[]> {
    const cached = this.parentCache.get(id);
    if (cached) return cached;
    const promise = this.driveGet<{ parents?: string[] }>(`files/${id}?fields=parents&supportsAllDrives=true`)
      .then((body) => body.parents ?? [])
      .catch(() => []);
    this.parentCache.set(id, promise);
    return promise;
  }

  private async isUnder(fileParents: string[], rootId: string): Promise<boolean> {
    let frontier = fileParents;
    for (let depth = 0; depth < 8 && frontier.length; depth += 1) {
      if (frontier.includes(rootId)) return true;
      frontier = (await Promise.all(frontier.map((id) => this.parents(id)))).flat();
    }
    return false;
  }

  private async loadFiles(vendor: Vendor): Promise<SavedFile[]> {
    const rootId = DRIVE_ROOT_IDS[vendor.driveRoot];
    const since = `${addDays(this.today, -150)}T00:00:00`;
    const query = `name contains '${vendor.driveName.replace(/'/g, "\\'")}' and mimeType != 'application/vnd.google-apps.folder' and trashed = false and createdTime > '${since}'`;
    const params = new URLSearchParams({
      q: query,
      fields: "files(id,name,parents,createdTime,webViewLink)",
      pageSize: "100",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      corpora: "allDrives",
    });
    const body = await this.driveGet<{ files?: Array<{ id: string; name: string; parents?: string[]; createdTime: string; webViewLink?: string }> }>(
      `files?${params.toString()}`,
    );
    const files: SavedFile[] = [];
    for (const file of body.files ?? []) {
      if (!(await this.isUnder(file.parents ?? [], rootId))) continue;
      files.push({ id: file.id, name: file.name, createdAt: file.createdTime, url: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view` });
    }
    return files;
  }
}
