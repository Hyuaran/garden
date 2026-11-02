import { withSystemView } from "@/lib/auth/system-view-page.server";
import { NoticeList } from "@/app/_components/notices/NoticeList";

// お知らせ一覧（System の外枠の中。全員が見られる）
function SystemNoticesPage() {
  return <NoticeList />;
}

export default withSystemView("system-notices", SystemNoticesPage);
