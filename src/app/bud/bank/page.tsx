import { withInitialUrlView } from "@/lib/ui/withInitialUrlView.server";
import BankAccounts from "./BankAccounts";

function BankPage() {
  return <BankAccounts />;
}

export default withInitialUrlView(BankPage);
