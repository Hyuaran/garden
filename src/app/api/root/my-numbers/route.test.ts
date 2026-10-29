import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({viewer:vi.fn(),db:vi.fn(),log:vi.fn(),decrypt:vi.fn()}));
vi.mock('@/lib/my-number/access.server',()=>({myNumberViewer:m.viewer,logMyNumberAccess:m.log}));
vi.mock('@/lib/supabase/admin',()=>({getSupabaseAdmin:m.db}));
vi.mock('@/lib/my-number/crypto.server',()=>({decryptMyNumber:m.decrypt}));
import {POST} from './route';
const request=(action:string,extra:Record<string,unknown>={})=>new Request('http://localhost/api/root/my-numbers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({employee_id:'E1',action,submitted_at:'2026-10-29T00:00:00Z',...extra})});
let rpc:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 vi.resetAllMocks();m.viewer.mockResolvedValue('EMP-0008');m.log.mockResolvedValue(undefined);m.decrypt.mockReturnValue('123456789018');
 rpc=vi.fn().mockResolvedValue({error:null});
 m.db.mockReturnValue({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{my_number_cipher:'cipher',submitted_at:'2026-10-29T00:00:00Z',photo_path:null},error:null})})})}),rpc});
});
it('指定表にない全権管理者も404で読み込めない',async()=>{m.viewer.mockResolvedValue(null);expect((await POST(request('display'))).status).toBe(404);expect(m.db).not.toHaveBeenCalled();});
it('表示のたびに記録してから復号する',async()=>{
 expect((await POST(request('display'))).status).toBe(200);expect((await POST(request('display'))).status).toBe(200);
 expect(m.log).toHaveBeenCalledTimes(2);expect(m.log).toHaveBeenCalledWith('EMP-0008','E1','display');
 expect(m.log.mock.invocationCallOrder[0]).toBeLessThan(m.decrypt.mock.invocationCallOrder[0]);
});
it('記録できなければ番号を返さない',async()=>{m.log.mockRejectedValue(new Error());expect((await POST(request('display'))).status).toBe(503);expect(m.decrypt).not.toHaveBeenCalled();});
it('新しい提出を古い画面から確認しない',async()=>{expect((await POST(request('confirm',{submitted_at:'old'}))).status).toBe(409);expect(rpc).not.toHaveBeenCalled();});
it('確認は記録と同じトランザクションで行う',async()=>{expect((await POST(request('confirm'))).status).toBe(200);expect(rpc).toHaveBeenCalledWith('review_my_number',expect.objectContaining({p_actor:'EMP-0008',p_action:'confirm'}));});
it('差し戻しは理由が必要で、通知は初期状態で停止する',async()=>{
 expect((await POST(request('reject'))).status).toBe(400);
 const fetchMock=vi.spyOn(globalThis,'fetch');
 const response=await POST(request('reject',{reason:'写真を確認できませんでした。'}));
 expect((await response.json()).notification).toBe('disabled');expect(fetchMock).not.toHaveBeenCalled();fetchMock.mockRestore();
});
