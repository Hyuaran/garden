import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import CeoStatusDashboard from "./components/CeoStatusDashboard";

function CeoStatusPage() {
  return <CeoStatusDashboard />;
}

export default withInitialUrlView(CeoStatusPage);
