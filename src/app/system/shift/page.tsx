import { withSystemView } from "@/lib/auth/system-view-page.server";
import MyPageSectionPage from "../mypage/_components/MyPageSectionPage";

export const metadata = { title: "シフト | Garden" };

function ShiftPage() {
  return <MyPageSectionPage section="shift" />;
}

export default withSystemView("system-shift", ShiftPage);
