import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import Client from "./UrlViewClient";
export default withInitialUrlView(Client, true);
