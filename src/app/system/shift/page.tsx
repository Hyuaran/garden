import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import { withSystemView } from "@/lib/auth/system-view-page.server";
import ShiftManager from "./ShiftManager";
export const metadata = { title: "シフト | Garden" };
function ShiftPage() {
  return <ShiftManager />;
}
export default withInitialUrlView(withSystemView("system-shift", ShiftPage));
