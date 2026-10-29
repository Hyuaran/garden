import { redirect } from 'next/navigation';
import { requireEmployee } from '@/app/system/mypage/_lib/submission-server';
import { withSystemView } from '@/lib/auth/system-view-page.server';
import ExpenseClient from './ExpenseClient';
export const metadata = { title: '経費 報告 | Garden' };
async function ExpensePage() {
  const employee = await requireEmployee();
  if (!employee) redirect('/login?returnTo=%2Fsystem%2Fforms%2Fexpense');
  return <ExpenseClient submitterName={String(employee.name)} employeeNumber={String(employee.employee_number)} />;
}
export default withSystemView('system-expense', ExpensePage, undefined, '/system/forms/expense');
