import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import { LeafForestView } from "@/lib/auth/leaf-forest-view.server";
import Content from "./view";
function Page() {
 return <LeafForestView page="leaf-kanden-input"><Content /></LeafForestView>;
}

export default withInitialUrlView(Page);
