import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({context:vi.fn(),admin:vi.fn()}));
vi.mock('@/lib/auth/view-permission.server',()=>({viewPermissionContext:m.context}));
vi.mock('@/lib/supabase/admin',()=>({getSupabaseAdmin:m.admin}));
import {myNumberViewer} from './access.server';
beforeEach(()=>vi.resetAllMocks());
it('役職が全権でも指定表に無ければ許可しない',async()=>{
 m.context.mockResolvedValue({viewer:{employeeId:'DEMO',role:'super_admin'}});
 const eq=vi.fn(()=>({maybeSingle:async()=>({data:null,error:null})}));m.admin.mockReturnValue({from:()=>({select:()=>({eq})})});
 expect(await myNumberViewer()).toBeNull();expect(eq).toHaveBeenCalledWith('employee_id','DEMO');
});
it('指定表にある従業員だけ許可する',async()=>{
 m.context.mockResolvedValue({viewer:{employeeId:'EMP-0008',role:'manager'}});
 m.admin.mockReturnValue({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{employee_id:'EMP-0008'},error:null})})})})});
 expect(await myNumberViewer()).toBe('EMP-0008');
});
