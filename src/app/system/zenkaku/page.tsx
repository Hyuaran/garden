import { withSystemView } from "@/lib/auth/system-view-page.server";
import MyPageSectionPage from "../mypage/_components/MyPageSectionPage";

export const metadata = { title: "前確依頼 | Garden" };

function ZenkakuPage() {
  return <MyPageSectionPage section="zenkaku" />;
}

export default withSystemView("system-zenkaku", ZenkakuPage);
