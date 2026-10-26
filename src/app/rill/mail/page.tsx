import { viewPermissionContext } from "@/lib/auth/view-permission.server";
import { RecruitMailView } from "@/lib/auth/sprout-rill-view.server";
import { RillMailScreen } from "./_components/RillMailScreen";

export default async function RillMailPage() { const {viewer} = await viewPermissionContext(); return <RecruitMailView page="rill-mail"><RillMailScreen canWrite={["admin", "super_admin"].includes(viewer.role)} /></RecruitMailView>; }
