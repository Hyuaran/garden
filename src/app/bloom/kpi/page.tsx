import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import KpiDashboard from "./components/KpiDashboard";

function BloomKpiPage() {
  return <KpiDashboard />;
}

export default withInitialUrlView(BloomKpiPage);
