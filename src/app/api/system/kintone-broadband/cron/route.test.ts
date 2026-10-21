import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/kintone-broadband/kanden-sync",()=>({runKandenSync:vi.fn().mockResolvedValue({actions:[]})}));
import {runKandenSync} from "@/lib/kintone-broadband/kanden-sync";
import {GET} from "./route";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it("auth precedes source access",async()=>{vi.stubEnv("CRON_SECRET","secret");expect((await GET(new Request("http://localhost/cron"))).status).toBe(401);expect(runKandenSync).not.toHaveBeenCalled();});
it("passes dry-run and live flags",async()=>{vi.stubEnv("CRON_SECRET","secret");for(const q of ["?dryRun=1",""]){expect((await GET(new Request(`http://localhost/cron${q}`,{headers:{authorization:"Bearer secret"}}))).status).toBe(200);expect(runKandenSync).toHaveBeenLastCalledWith(q!=="");}});
