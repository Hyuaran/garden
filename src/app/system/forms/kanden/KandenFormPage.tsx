import { requireSystemView } from "@/lib/auth/view-permission.server";
import { countUrgentSubmissions, employeeRecord, recentSubmissions } from "@/lib/leaf-kanden/submissions.server";
import { isRoleAtLeast } from "@/app/root/_constants/types";
import { FormPage, ResultMessage } from "../_components/form-kit";
import KandenForm from "./KandenForm";
import { kandenOpen } from "@/lib/leaf-kanden/rollout";

export default async function KandenFormPage({ mobile = false }: { mobile?: boolean }) {
  const context = await requireSystemView("system-forms-kanden");
  if (!isRoleAtLeast(context.viewer.role, "staff")) {
    return <FormPage title="関電 申込の送信" mobile={mobile} submitterName="" employeeNumber="">
      <ResultMessage>この画面は社員以上が使えます。</ResultMessage>
    </FormPage>;
  }
  if (!kandenOpen(context.viewer.role)) {
    return <FormPage title="関電 申込の送信" mobile={mobile} submitterName="" employeeNumber="">
      <ResultMessage>2026年12月1日から使えます。</ResultMessage>
    </FormPage>;
  }
  const employee = await employeeRecord(context);
  const [recent, urgentCount] = await Promise.all([
    recentSubmissions(employee.id).catch(() => null),
    countUrgentSubmissions(employee.id).catch(() => null),
  ]);
  return <KandenForm name={employee.name} number={employee.number} mobile={mobile}
    initialRecent={recent} initialUrgentCount={urgentCount} />;
}
