import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import { BudView } from "@/lib/auth/bud-view.server";
import ProfitContent from "./ProfitContent";
function Page() { return <BudView pageKey="bud-profit"><ProfitContent /></BudView>; }

export default withInitialUrlView(Page);
