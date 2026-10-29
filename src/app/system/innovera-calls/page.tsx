import { withSystemView } from "@/lib/auth/system-view-page.server";
import InnoveraCallsContent from "./InnoveraCallsContent";
export const metadata = { title: "INNOVERA履歴・録音 | Garden" };
export default withSystemView("system-innovera-calls", InnoveraCallsContent);
