import { extractReport, object, rows, text, type Row } from "./model";
export type Snapshot = { deployment_id: string; checked_at: string; fetched_at: string; updated: string; data: Row; failed: boolean };
export type Store = { read(): Promise<Snapshot | null>; save(value: Snapshot): Promise<void> };
const TEAM = "team_ouuyJL0pnmM9XDqKcf1fU9Qd";
export async function readSnapshot(store: Store, token: string | undefined, force = false, request: typeof fetch = fetch, now = new Date()): Promise<{ snapshot: Snapshot | null; warning: boolean }> {

  const previous = await store.read();

  if(!force && previous && now.getTime() - Date.parse(previous.checked_at) < 600_000) {

    return { snapshot: previous, warning: previous.failed };
  }

  const get = async (path: string) => {

    if(!token) throw new Error("報告を読み込めませんでした");

    const response = await request(`https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${TEAM}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
    });

    if(!response.ok) throw new Error("報告を読み込めませんでした");

    return response.json() as Promise<unknown>;
  };
  try {

    const listing = object(await get("/v6/deployments?app=ichihikari-report&target=production&state=READY&limit=1"));

    const id = text(rows(listing.deployments)[0]?.uid);

    if(!id) throw new Error("報告を読み込めませんでした");

    if(previous?.deployment_id === id) {

      const snapshot = { ...previous, checked_at: now.toISOString(), failed: false };

      await store.save(snapshot);

      return { snapshot, warning: false };
    }

    const tree = await get(`/v6/deployments/${encodeURIComponent(id)}/files`);

    const find = (nodes: unknown, parent = ""): string => {

      for(const node of rows(nodes)) {

        const path = parent ? `${parent}/${text(node.name)}` : text(node.name);

        if(path === "src/data/report.html") return text(node.uid);

        const nested = find(node.children, path);

        if(nested) return nested;
      }

      return "";
    };

    const uid = find(Array.isArray(tree) ? tree : object(tree).files);

    if(!uid) throw new Error("報告を読み込めませんでした");

    const file = object(await get(`/v7/deployments/${encodeURIComponent(id)}/files/${encodeURIComponent(uid)}`));

    // 実際の Vercel の返事は { data } だけで encoding が付かない（2026-11-12 本番で確認）。付いていれば base64 だけ受ける
    if((file.encoding !== undefined && file.encoding !== "base64") || typeof file.data !== "string") throw new Error("報告を読み込めませんでした");

    const data = extractReport(Buffer.from(file.data, "base64").toString("utf8"));

    const snapshot: Snapshot = { deployment_id: id, checked_at: now.toISOString(), fetched_at: now.toISOString(), updated: text(data.updated), data, failed: false };

    await store.save(snapshot);

    return { snapshot, warning: false };

  } catch {

    if(previous) {

      const snapshot = { ...previous, checked_at: now.toISOString(), failed: true };

      try {
        await store.save(snapshot);
      } catch { /* Keep the last saved report available. */ }

      return { snapshot, warning: true };
    }

    return { snapshot: null, warning: true };
  }
}
