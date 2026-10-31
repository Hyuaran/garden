import {describe,it,expect,vi,beforeEach} from "vitest";
const mocks=vi.hoisted(()=>({user:{id:"u"} as {id:string}|null,active:true,hire:"2026-10-28" as string|null,pending:true,needs:vi.fn(),redirect:vi.fn((url:string)=>{throw Error(url)})}));
vi.mock("next/navigation",()=>({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search),redirect:mocks.redirect}));
vi.mock("@/app/_lib/supabase/server",()=>({createServerClient:async()=>({auth:{getUser:async()=>({data:{user:mocks.user}})},from:()=>({select(){return this},eq(){return this},is(){return this},maybeSingle:async()=>({data:{employee_id:"e",name:"社員A",hire_date:mocks.hire,is_active:mocks.active}})})})}));
vi.mock("@/app/system/onboarding/_lib/onboarding.server",()=>({needsOnboarding:mocks.needs}));
vi.mock("@/app/system/mypage/_components/MyPageSectionPage",()=>({default:()=>null}));
vi.mock("@/app/system/innovera-calls/InnoveraCallsContent",()=>({default:()=>null}));
vi.mock("./MyShell",()=>({default:()=>null}));
import Page from "./page";
describe("my page server",()=>{
 beforeEach(()=>{mocks.user={id:"u"};mocks.active=true;mocks.hire="2026-10-28";mocks.needs.mockReset();});
 it.each([true,false])("shows onboarding only when pending %s",async(pending)=>{
 mocks.needs.mockResolvedValue(pending); const page=await Page({searchParams:Promise.resolve({tab:"profile"})});
 expect(Boolean(page.props.children[0])).toBe(pending);expect(mocks.needs).toHaveBeenCalledWith(expect.anything(),"e");
 });
 it("keeps the requested tab through login",async()=>{mocks.user=null;await expect(Page({searchParams:Promise.resolve({tab:"calls"})})).rejects.toThrow("/login?returnTo=%2Fmy%3Ftab%3Dcalls");});
 it("requires an active account",async()=>{mocks.active=false;await expect(Page({searchParams:Promise.resolve({})})).rejects.toThrow("/login?returnTo=%2Fmy");});
 it("loads the calls content",async()=>{const page=await Page({searchParams:Promise.resolve({tab:"calls"})});expect(page.props.tab).toBe("calls");expect(mocks.needs).not.toHaveBeenCalled();});
});
