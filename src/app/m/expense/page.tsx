import { redirect } from 'next/navigation';
import { requireEmployee } from '@/app/system/mypage/_lib/submission-server';
import { withSystemView } from '@/lib/auth/system-view-page.server';
import ExpenseClient from '@/app/system/forms/expense/ExpenseClient';
export const metadata = { title: '経費 報告 | Garden' };
async function MobileExpensePage() {
  const employee = await requireEmployee();
  if (!employee) redirect('/login?returnTo=%2Fm%2Fexpense');
  return <ExpenseClient submitterName={String(employee.name)} employeeNumber={String(employee.employee_number)} />;
}
export default withSystemView('system-expense', MobileExpensePage, undefined, '/m/expense');
