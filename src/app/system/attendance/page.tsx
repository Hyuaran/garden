import { withSystemView } from "@/lib/auth/system-view-page.server";
import MyPageSectionPage from "../mypage/_components/MyPageSectionPage";

export const metadata = { title: "勤怠打刻 | Garden" };

function AttendancePage() {
  return <MyPageSectionPage section="attendance" />;
}


export default withSystemView("system-attendance", AttendancePage);
