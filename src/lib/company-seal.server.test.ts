import {expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const download=vi.hoisted(()=>vi.fn());
const from=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:()=>({storage:{from}})}));
import {loadCompanySeal} from "./company-seal.server";
import {readdir,readFile} from "node:fs/promises";
import path from "node:path";
it("loads a private company_id PNG as an inline image",async()=>{
 from.mockReturnValue({download});download.mockResolvedValue({data:new Blob([new Uint8Array([1,2,3])]),error:null});
 expect(await loadCompanySeal("COMP-001")).toBe("data:image/png;base64,AQID");
 expect(from).toHaveBeenCalledWith("company-seals");expect(download).toHaveBeenCalledWith("COMP-001.png");
});
it("omits the seal when not registered",async()=>{
 download.mockResolvedValue({data:null,error:{message:"not found"}});
 expect(await loadCompanySeal("COMP-002")).toBeUndefined();
 expect(await loadCompanySeal(null)).toBeUndefined();
});
it("keeps seals private and outside public",async()=>{
 const files=await readdir(path.join(process.cwd(),"public"),{recursive:true});
 expect(files.some(f=>/角印|company-seals|company.?seal/i.test(f))).toBe(false);
 const migration=await readFile("supabase/migrations/20261027000452_company_seals.sql","utf8");
 expect(migration).toContain("'company-seals', 'company-seals', false");
});
