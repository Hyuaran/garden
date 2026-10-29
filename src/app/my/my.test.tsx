import { render, screen, within } from "@testing-library/react";
import { describe,it,expect,vi } from "vitest";
vi.mock("@/app/_lib/theme/ThemeProvider",()=>({useTheme:()=>({theme:"light",setTheme:vi.fn()})}));
vi.mock("@/app/_lib/supabase/browser",()=>({createBrowserClient:vi.fn()}));
import MyShell from "./MyShell";
import { MY_TABS, resolveMyTab } from "./tabs";
describe("dedicated my page",()=>{
 it.each(MY_TABS)("opens $id with only personal navigation",item=>{
 render(<MyShell tab={resolveMyTab(item.id)} name="社員A"><p>内容</p></MyShell>);
 expect(screen.getByRole("heading",{level:1})).toHaveTextContent(item.label);
 expect(screen.getAllByRole("tab")).toHaveLength(7);
 const nav=screen.getByRole("navigation",{name:"マイページ"});
 expect(within(nav).getAllByRole("link")).toHaveLength(7);
 // ほかの画面と同じ右上の一式を出すので、ベルの「お知らせ一覧」だけは許す。それ以外は /my の中だけ
 for(const a of screen.getAllByRole("link"))expect(a.getAttribute("href")).toMatch(/^\/my\?tab=|^\/system\/notices$/);
 expect(screen.queryByRole("complementary")).toBeNull();
 expect(screen.queryByRole("button",{name:"利用者メニュー"})).toBeNull();
 });
 it("defaults to profile",()=>{expect(resolveMyTab(undefined)).toBe("profile");expect(resolveMyTab("unknown")).toBe("profile");});
});
