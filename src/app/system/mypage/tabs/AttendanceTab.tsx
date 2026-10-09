import AttendanceClient from "../../attendance/AttendanceClient";

export default function AttendanceTab(props: { registered: boolean; employeeName: string | null; canViewSync: boolean; needsExtension: boolean }) {
  return <AttendanceClient {...props} embedded />;
}
