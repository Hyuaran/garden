import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import ProgressDashboard from "./components/ProgressDashboard";

function BloomProgressPage() {
  return <ProgressDashboard />;
}

export default withInitialUrlView(BloomProgressPage);
