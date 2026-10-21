import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({run:vi.fn(),auth:vi.fn()}));
vi.mock("@/lib/cron-auth",()=>({verifyBearerRequest:mocks.auth}));
vi.mock("@/lib/bud/broadband/run",()=>({runRecon:mocks.run}));
import { GET } from "./route";
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockReturnValue({ok:true});mocks.run.mockResolvedValue({dryRun:true,counts:{matched:1}});});
it("requires cron authentication",async()=>{mocks.auth.mockReturnValue({ok:false,status:401,reason:"unauthorized"});expect((await GET(new Request("http://localhost/api"))).status).toBe(401);expect(mocks.run).not.toHaveBeenCalled();});
it("passes dryRun and disables caching",async()=>{const response=await GET(new Request("http://localhost/api?dryRun=1"));expect(mocks.run).toHaveBeenCalledWith(true);expect(response.headers.get("Cache-Control")).toBe("no-store");expect(await response.json()).toMatchObject({dryRun:true});});
