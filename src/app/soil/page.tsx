import { withSystemView } from "@/lib/auth/system-view-page.server";
import { canView, viewPermissionContext } from "@/lib/auth/view-permission.server";
import { SOIL_VIEW_SCOPES } from "@/lib/auth/soil-view-scopes";
import SoilHome from "./view";

async function Page() {
  const { viewer } = await viewPermissionContext();
  const viewAccess = Object.fromEntries(await Promise.all(
    SOIL_VIEW_SCOPES.map(async scope => [scope.pageKey, await canView(scope.pageKey, "", viewer)]),
  ));
  return <SoilHome viewAccess={viewAccess} />;
}

export default withSystemView("soil-overview", Page, undefined, "/soil");
