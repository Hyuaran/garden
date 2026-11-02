import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import { LeafForestView } from "@/lib/auth/leaf-forest-view.server";
import Content from "./view";
function Page() {
 return <LeafForestView page="forest-shinkouki"><Content /></LeafForestView>;
}

export default withInitialUrlView(Page);
