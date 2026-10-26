import { LeafForestView } from "@/lib/auth/leaf-forest-view.server";
import Content from "./view";
export default function Page(props: { params: Promise<{ companyId: string }> }) {
 return <LeafForestView page="forest-shinkouki-company"><Content {...props}/></LeafForestView>;
}
