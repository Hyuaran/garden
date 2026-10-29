// @vitest-environment node
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import sharp from 'sharp';
const m=vi.hoisted(()=>({verify:vi.fn(),db:vi.fn()}));
vi.mock('@/app/system/mypage/_lib/submission-server',()=>({requireEmployee:m.verify}));
vi.mock('@/lib/supabase/admin',()=>({getSupabaseAdmin:m.db}));
import {GET,POST,PATCH} from './route';
import {decryptMyNumber} from '@/lib/my-number/crypto.server';
async function request(options:{number?:string;consent?:string;photo?:boolean}={}){
 const form=new FormData();form.set('my_number',options.number??'123456789018');form.set('consent',options.consent??'true');
 if(options.photo!==false){const bytes=await sharp({create:{width:10,height:10,channels:3,background:'white'}}).png().toBuffer();form.set('photo',new Blob([new Uint8Array(bytes)],{type:'image/png'}),'card.png');}
 return new Request('http://localhost/api/liff/my-number',{method:'POST',headers:{Authorization:'Bearer token'},body:form});
}
let upsert:ReturnType<typeof vi.fn>,upload:ReturnType<typeof vi.fn>,rpc:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv('MY_NUMBER_ENCRYPTION_KEY',Buffer.alloc(32,1).toString('base64'));
 m.verify.mockResolvedValue({employee_id:'E1',name:'山田'});upsert=vi.fn().mockResolvedValue({error:null});upload=vi.fn().mockResolvedValue({error:null});rpc=vi.fn().mockResolvedValue({data:true,error:null});
 m.db.mockReturnValue({from:()=>({upsert}),rpc,storage:{from:()=>({upload,remove:vi.fn()})}});
});
afterEach(()=>vi.unstubAllEnvs());
it.each([{consent:'false'},{number:'123'},{number:'123456789012'},{photo:false}])('同意・番号・写真が不備なら保存しない %j',async options=>{expect((await POST(await request(options))).status).toBe(400);expect(m.db).not.toHaveBeenCalled();});
it('従業員でない人は403',async()=>{m.verify.mockResolvedValue(null);expect((await POST(await request())).status).toBe(401);expect(m.db).not.toHaveBeenCalled();});
it('暗号化して保存し、番号を本人の応答に含めない',async()=>{
 const response=await POST(await request());expect(response.status).toBe(200);
 const payload=upsert.mock.calls[0][0];expect(payload.my_number).toBeNull();expect(decryptMyNumber(payload)).toBe('123456789018');
 expect(payload.photo_path).toMatch(/^E1\/.+\.jpg$/);expect(upload).toHaveBeenCalledOnce();
 expect(JSON.stringify(await response.json())).not.toContain('123456789018');
 expect(rpc).toHaveBeenCalledWith('consume_liff_submission_limit',{p_employee_id:'E1'});
});
it('共通の回数制限で写真保存前に止める',async()=>{rpc.mockResolvedValue({data:false,error:null});expect((await POST(await request())).status).toBe(429);expect(upload).not.toHaveBeenCalled();});
it('本人の状況取得で暗号文・平文・写真を選択しない',async()=>{
 const select=vi.fn(()=>({eq:()=>({maybeSingle:async()=>({data:{status:'pending',my_number_last4:'9018'},error:null}),single:async()=>({data:{my_number_deferred_on:null},error:null})})}));m.db.mockReturnValue({from:()=>({select})});
 expect((await GET()).status).toBe(200);
 expect(select).toHaveBeenCalledWith('my_number_last4,status,submitted_at,rejection_reason');
});
it.each([null,{status:'rejected'},{status:'pending'},{status:'confirmed'}])('提出状況に応じた案内判定 %j',async row=>{
 m.db.mockReturnValue({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:row,error:null}),single:async()=>({data:{my_number_deferred_on:null},error:null})})})})});
 expect((await (await GET()).json()).prompt).toBe(!row||row.status==='rejected');
});
it('あとでは日本時間の日付を本人に記録し、同日は案内しない',async()=>{
 const date=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
 const eq=vi.fn().mockResolvedValue({error:null}),update=vi.fn(()=>({eq}));
 m.db.mockReturnValue({from:()=>({update,select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null}),single:async()=>({data:{my_number_deferred_on:date},error:null})})})})});
 expect((await PATCH()).status).toBe(200);expect(update).toHaveBeenCalledWith({my_number_deferred_on:date});expect(eq).toHaveBeenCalledWith('employee_id','E1');
 expect((await (await GET()).json()).prompt).toBe(false);
});
