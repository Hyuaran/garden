vi.mock("@/lib/auth/system-view-page.server", () => ({ withSystemView: (_key: string, page: unknown) => page }));
vi.mock('@/lib/auth/bloom-tree-view.server',()=>({requireBloomTreeRead:vi.fn().mockResolvedValue({})}));
import { beforeEach, describe, expect, it, vi } from "vitest";
const redirect = vi.hoisted(()=>vi.fn());
vi.mock("next/navigation",()=>({redirect}));
import TreeMyPage from "@/app/tree/mypage/page";
import AttendancePage from "@/app/system/attendance/page";
import ShiftPage from "@/app/system/shift/page";
import ZenkakuPage from "@/app/system/zenkaku/page";
import MyPagePage from "../page";

describe("legacy mypage redirects",()=>{
  beforeEach(()=>redirect.mockReset());
  it("moves the Tree URL to System",async()=>{await TreeMyPage();expect(redirect).toHaveBeenCalledWith("/system/mypage");});
  it("moves an old attendance query to the standalone URL",async()=>{
    await MyPagePage({searchParams:Promise.resolve({tab:"attendance"})});
    expect(redirect).toHaveBeenCalledWith("/my?tab=attendance");
  });
  it("connects each standalone URL to its existing tab content",async()=>{
    await AttendancePage(); expect(redirect).toHaveBeenLastCalledWith("/my?tab=attendance");
    await ShiftPage(); expect(redirect).toHaveBeenLastCalledWith("/my?tab=shift");
    await ZenkakuPage(); expect(redirect).toHaveBeenLastCalledWith("/my?tab=zenkaku");
  });
});
