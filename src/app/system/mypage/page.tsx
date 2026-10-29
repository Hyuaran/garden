import { redirect } from "next/navigation";
import { MY_PAGE_ROUTES, type MyPageTab } from "@/app/system/mypage/types";
export default async function Page({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<{tab?: string | string[]}> } = {}) {
 const tab = (await searchParams).tab;
 redirect(MY_PAGE_ROUTES[typeof tab === "string" && tab in MY_PAGE_ROUTES ? tab as MyPageTab : "profile"]);
}
