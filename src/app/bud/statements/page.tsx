import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import { BudView } from "@/lib/auth/bud-view.server";
import StatementsTabs from "./StatementsTabs";
function Page() { return <BudView pageKey="bud-statements"><StatementsTabs /></BudView>; }

export default withInitialUrlView(Page);
