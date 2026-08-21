import { beforeEach, describe, expect, it, vi } from "vitest";
const redirect = vi.hoisted(()=>vi.fn());
vi.mock("next/navigation",()=>({redirect}));
import TreeMyPage from "@/app/tree/mypage/page";
import AttendancePage from "@/app/system/attendance/page";

describe("legacy mypage redirects",()=>{
  beforeEach(()=>redirect.mockReset());
  it("moves the Tree URL to System",()=>{TreeMyPage();expect(redirect).toHaveBeenCalledWith("/system/mypage");});
  it("moves attendance to its mypage tab",async()=>{await AttendancePage();expect(redirect).toHaveBeenCalledWith("/system/mypage?tab=attendance");});
});
