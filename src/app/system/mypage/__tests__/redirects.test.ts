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
  it("moves an old attendance query to the System attendance page",async()=>{
    await MyPagePage({searchParams:Promise.resolve({tab:"attendance"})});
    expect(redirect).toHaveBeenCalledWith("/system/attendance");
  });
  it("opens each System page inside System instead of leaving for /my",()=>{
    expect(AttendancePage()).toMatchObject({props:{section:"attendance"}});
    expect(ShiftPage()).toMatchObject({props:{section:"shift"}});
    expect(ZenkakuPage()).toMatchObject({props:{section:"zenkaku"}});
    expect(redirect).not.toHaveBeenCalled();
  });
});
