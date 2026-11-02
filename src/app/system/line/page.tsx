import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import { withSystemView } from "@/lib/auth/system-view-page.server";
import LineManager from './LineManager';
async function Page() { return <LineManager />; }
export default withInitialUrlView(withSystemView("system-line", Page));
