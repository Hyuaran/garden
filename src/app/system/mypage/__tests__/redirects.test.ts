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
  it("moves the Tree URL to System",()=>{TreeMyPage();expect(redirect).toHaveBeenCalledWith("/system/mypage");});
  it("moves an old attendance query to the standalone URL",async()=>{
    await MyPagePage({searchParams:Promise.resolve({tab:"attendance"})});
    expect(redirect).toHaveBeenCalledWith("/system/attendance");
  });
  it("connects each standalone URL to its existing tab content",()=>{
    expect(AttendancePage().props.section).toBe("attendance");
    expect(ShiftPage().props.section).toBe("shift");
    expect(ZenkakuPage().props.section).toBe("zenkaku");
  });
});
