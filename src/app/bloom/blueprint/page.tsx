import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import BlueprintDashboard from "./components/BlueprintDashboard";

function BloomBlueprintPage() {
  return <BlueprintDashboard />;
}

export default withInitialUrlView(BloomBlueprintPage);
