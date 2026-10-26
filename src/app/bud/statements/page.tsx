import { BudView } from "@/lib/auth/bud-view.server";
import StatementsContent from "./StatementsContent";
export default function Page() { return <BudView pageKey="bud-statements" tabKey="list"><StatementsContent /></BudView>; }
