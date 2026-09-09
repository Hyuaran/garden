import { buildPermissionMatrix, buildRoleSummary } from "@/lib/auth/permission-registry";
import PermissionsClient from "./PermissionsClient";

export const metadata = {
  title: "権限一覧 | Garden Root",
};

export default function PermissionsPage() {
  return <PermissionsClient initialPermissionRows={buildPermissionMatrix()} roleSummary={buildRoleSummary()} />;
}
