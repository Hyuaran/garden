import { redirect } from "next/navigation";
import MyPageSectionPage from "./_components/MyPageSectionPage";
import { MY_PAGE_ROUTES, type MyPageTab } from "./types";

export const metadata = { title: "自分の情報 | Garden" };
const LEGACY_TABS = new Set<MyPageTab>(["attendance", "shift", "zenkaku"]);

export default async function MyPagePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const rawTab = (await searchParams).tab;
  if (typeof rawTab === "string" && LEGACY_TABS.has(rawTab as MyPageTab))
    redirect(MY_PAGE_ROUTES[rawTab as MyPageTab]);
  return <MyPageSectionPage section="profile" />;
}
