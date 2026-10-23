import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks = vi.hoisted(()=>({user:vi.fn(), employee:vi.fn()}));
vi.mock("@/app/_lib/supabase/server",()=>({createServerClient:async()=>({auth:{getUser:mocks.user},from:()=>{
  const q={select:()=>q,eq:()=>q,is:()=>q,maybeSingle:mocks.employee};return q;
}})}));
import { sproutUser, requireSproutUser } from "./access.server";
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({data:{user:{id:"user"}}});});
it("denies unauthenticated users and non-super administrators",async()=>{
  mocks.user.mockResolvedValueOnce({data:{user:null}});
  expect(await sproutUser()).toBeNull(); expect(mocks.employee).not.toHaveBeenCalled();
  for(const role of ["staff","admin","manager",null]) {
    mocks.employee.mockResolvedValue({data:{garden_role:role},error:null});
    await expect(requireSproutUser()).rejects.toThrow("閲覧権限");
  }
});
it("fails closed on employee lookup errors and permits only an active super administrator",async()=>{
  mocks.employee.mockResolvedValueOnce({data:{garden_role:"super_admin"},error:{message:"failure"}});
  expect(await sproutUser()).toBeNull();
  mocks.employee.mockResolvedValue({data:{garden_role:"super_admin"},error:null});
  expect(await requireSproutUser()).toEqual({id:"user"});
});
