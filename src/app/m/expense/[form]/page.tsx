import { notFound, redirect } from 'next/navigation';
import { requireEmployee } from '@/app/system/mypage/_lib/submission-server';
import { withSystemView } from '@/lib/auth/system-view-page.server';
import ExpenseClient from '@/app/system/forms/expense/ExpenseClient';
import { isExpenseForm } from '@/app/system/forms/expense/_lib/expense';
export const metadata = { title: '経費 報告 | Garden' };
// 現場に配る入口。種類ごとに URL を分け、タブを出さずにそのフォームだけを開く
async function MobileExpenseFormPage({ params }: { params: Promise<{ form: string }> }) {
  const { form } = await params;
  if (!isExpenseForm(form)) notFound();
  const employee = await requireEmployee();
  if (!employee) redirect(`/login?returnTo=${encodeURIComponent(`/m/expense/${form}`)}`);
  return <ExpenseClient submitterName={String(employee.name)} employeeNumber={String(employee.employee_number)} fixedForm={form} />;
}
export default withSystemView('system-expense', MobileExpenseFormPage, undefined, '/m/expense');
