import { beforeEach,expect,it,vi } from 'vitest';
const m=vi.hoisted(()=>({read:vi.fn(),denied:vi.fn(),sync:vi.fn()}));
vi.mock('@/lib/auth/view-permission.server',()=>({systemViewResponse:m.denied}));
vi.mock('@/lib/auth/system-view-api.server',()=>({requireViewEmployee:m.read}));
vi.mock('@/lib/innovera/sync.server',()=>({runInnoveraSync:m.sync}));
import { GET,POST } from './route';
beforeEach(()=>vi.resetAllMocks());
it('同期画面の閲覧権限がなければ読み取りも反映も拒否する',async()=>{
 m.read.mockResolvedValue(null);m.denied.mockResolvedValue(Response.json({}, {status:403}));
 expect((await GET()).status).toBe(403);expect(m.read).toHaveBeenCalledWith('system-innovera','','staff');
 expect((await POST()).status).toBe(403);expect(m.denied).toHaveBeenCalledWith('system-innovera','');
 expect(m.sync).not.toHaveBeenCalled();
});
it('許可された本人のIDで確認する',async()=>{
 m.read.mockResolvedValue({employee_id:'E1'});m.sync.mockResolvedValue({ok:true});
 expect((await GET()).status).toBe(200);expect(m.sync).toHaveBeenCalledWith({apply:false,trigger:'manual',actorEmployeeId:'E1',includeLogs:true});
});
