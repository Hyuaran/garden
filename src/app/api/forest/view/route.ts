import { NextRequest } from "next/server";
import { requireForestDataRead, requireLeafForestRead } from "@/lib/auth/leaf-forest-view.server";
import { ViewPermissionError, readViewPermissions, viewPermissionContext } from "@/lib/auth/view-permission.server";
import { effectivePermission } from "@/lib/auth/view-permission";
import { LEAF_FOREST_TABS } from "@/lib/auth/leaf-forest-view-scopes";
import { isRoleAtLeast } from "@/app/root/_constants/types";
import { readForestSnapshot, readForestHankanhi, readForestJournalMasters } from "@/app/forest/read-actions";
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const page = query.get("page") ?? "";
  const tab = query.get("tab") || undefined;
  try {
    if (!page.startsWith("forest-")) throw new ViewPermissionError("閲覧権限がありません");
    if (query.get("kind") === "access") {
      if (["forest-dashboard", "forest-shinkouki", "forest-shinkouki-company"].includes(page)) await requireForestDataRead(page, tab);
      else await requireLeafForestRead(page, tab);
      const permissions = await readViewPermissions();
      const configured = (LEAF_FOREST_TABS[page] ?? [["", ""]]).some(([key]) => !!effectivePermission(permissions, page, key));
      const { viewer } = await viewPermissionContext();
      return Response.json({ allowed: true, configured, legacyEntryAllowed: isRoleAtLeast(viewer.role, "manager") }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const result = query.get("kind") === "journal"
      ? await readForestJournalMasters(page, query.get("corp") || undefined)
      : query.get("kind") === "hankanhi"
      ? await readForestHankanhi(page, tab, query.get("company") ?? "", Number(query.get("ki")))
      : await readForestSnapshot(page, tab);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ViewPermissionError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
