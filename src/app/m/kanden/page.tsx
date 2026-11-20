import { withSystemView } from "@/lib/auth/system-view-page.server";
import KandenFormPage from "@/app/system/forms/kanden/KandenFormPage";

export const metadata = { title: "関電 申込の送信 | Garden" };
export const maxDuration = 60;

async function Page() {
  return <KandenFormPage mobile />;
}
export default withSystemView("system-forms-kanden", Page, undefined, "/m/kanden");
