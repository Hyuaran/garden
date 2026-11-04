import AttendanceClient from "@/app/system/attendance/AttendanceClient";
import { resolveAttendanceEmployee } from "@/app/api/system/attendance/_lib/auth";
import { needsDailyExtension } from "@/lib/innovera/daily-extension";
import { withSystemView } from "@/lib/auth/system-view-page.server";
async function Page() {
  const identity = await resolveAttendanceEmployee();
  return <AttendanceClient registered={identity.ok} employeeName={identity.ok ? identity.employee.name : null}
    canViewSync={false} needsExtension={identity.ok && needsDailyExtension(identity.employee)} mobile />;
}
export default withSystemView("system-attendance", Page);
