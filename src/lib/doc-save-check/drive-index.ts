import { getDriveAccessToken } from "@/app/api/bud/expense-drive/_lib/drive";
import { graphFetch } from "../mail-payment-check/graph-mail";

/** 保存先の全階層。50フォルダずつまとめて読み、ページと循環を処理する。 */
export async function buildDriveIndex(rootId: string): Promise<Set<string>> {
  const token = await getDriveAccessToken();
  const pending = [rootId];
  const visited = new Set([rootId]);
  const checksums = new Set<string>();
  while (pending.length) {
    const batch = pending.splice(0, 50);
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q: `(${batch.map(id => `'${id.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' in parents`).join(" or ")}) and trashed=false`,
        fields: "nextPageToken,files(id,mimeType,md5Checksum)",
        pageSize: "1000", supportsAllDrives: "true", includeItemsFromAllDrives: "true",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const response = await graphFetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      if (!response.ok) throw new Error(`Drive を読めません（${rootId}: ${response.status}）`);
      const body: { nextPageToken?: string; files?: Array<{ id: string; mimeType: string; md5Checksum?: string }> } = await response.json();
      for (const file of body.files ?? []) {
        if (file.mimeType === "application/vnd.google-apps.folder" && !visited.has(file.id)) {
          visited.add(file.id); pending.push(file.id);
        } else if (file.md5Checksum) checksums.add(file.md5Checksum.toLowerCase());
      }
      pageToken = body.nextPageToken;
    } while (pageToken);
  }
  return checksums;
}
