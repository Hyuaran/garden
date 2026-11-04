import { withSystemView } from "@/lib/auth/system-view-page.server";
import { hakenContext, loadHakenData } from "@/lib/haken/server";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import HakenClient from "./HakenClient";
import { viewPermissionContext } from "@/lib/auth/view-permission.server";
async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { db } = await hakenContext();
  const tab = (await searchParams).tab;
  return (
    <HakenClient
      initialData={await loadHakenData(db)}
      canWrite={Boolean(await requireManager())}
      admin={(await viewPermissionContext()).viewer.role === "super_admin"}
      initialTab={tab === "parties" || tab === "deadlines" ? tab : "workers"}
    />
  );
}
export default withSystemView("system-haken", Page);
