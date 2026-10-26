import { LeafForestView } from "@/lib/auth/leaf-forest-view.server";
import Content from "./view";
export default function Page() {
 return <LeafForestView page="forest-journal"><Content /></LeafForestView>;
}
