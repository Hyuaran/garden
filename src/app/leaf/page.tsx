import { withSystemView } from "@/lib/auth/system-view-page.server";
import { canView, viewPermissionContext } from "@/lib/auth/view-permission.server";
import { LEAF_VIEW_SCOPES } from "@/lib/auth/leaf-view-scopes";
import LeafHome from "./view";

async function Page() {
  const { viewer } = await viewPermissionContext();
  const viewAccess = Object.fromEntries(await Promise.all(
    LEAF_VIEW_SCOPES.map(async scope => [scope.pageKey, await canView(scope.pageKey, "", viewer)]),
  ));
  return <LeafHome viewAccess={viewAccess} />;
}

export default withSystemView("leaf-overview", Page, undefined, "/leaf");
