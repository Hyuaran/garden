import { withSystemView } from "@/lib/auth/system-view-page.server";
import { redirect } from "next/navigation";
import MyNumberPrompt from "@/app/my/MyNumberPrompt";
import MyPageSectionPage from "./_components/MyPageSectionPage";
import { MY_PAGE_ROUTES, type MyPageTab } from "./types";

export const metadata = { title: "自分の情報 | Garden" };
const LEGACY_TABS = new Set<MyPageTab>(["attendance", "shift", "zenkaku"]);

// System の中で開く「自分の情報」（左のメニューつき）。/my はメニューなしのマイページ専用の入口として別に残す。
async function MyPagePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const rawTab = (await searchParams).tab;
  if (typeof rawTab === "string" && LEGACY_TABS.has(rawTab as MyPageTab))
    redirect(MY_PAGE_ROUTES[rawTab as MyPageTab]);
  return <><MyNumberPrompt locked={false} profile /><MyPageSectionPage section="profile" /></>;
}

export default withSystemView("system-mypage", MyPagePage);
