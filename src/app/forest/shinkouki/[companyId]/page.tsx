import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import { LeafForestView } from "@/lib/auth/leaf-forest-view.server";
import Content from "./view";
function Page(props: { params: Promise<{ companyId: string }> }) {
 return <LeafForestView page="forest-shinkouki-company"><Content {...props}/></LeafForestView>;
}

export default withInitialUrlView(Page);
