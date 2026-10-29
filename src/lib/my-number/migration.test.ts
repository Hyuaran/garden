// @vitest-environment node
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
const m=vi.hoisted(()=>({createClient:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:m.createClient}));
const argv=process.argv;
let update:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 vi.resetModules();vi.resetAllMocks();vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://test.invalid');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test');vi.stubEnv('MY_NUMBER_ENCRYPTION_KEY',Buffer.alloc(32,1).toString('base64'));
 update=vi.fn(()=>{const query={eq:vi.fn().mockReturnThis(),select:vi.fn().mockResolvedValue({data:[{employee_id:'E1'}],error:null})};return query;});
 m.createClient.mockReturnValue({from:(table:string)=>({select:()=>({order:()=>({range:async()=>({data:table==='root_employee_my_numbers'?[{employee_id:'E1',my_number:'123456789018',updated_at:'now'}]:[],error:null})})}),update})});
 vi.spyOn(console,'log').mockImplementation(()=>{});
});
afterEach(()=>{process.argv=argv;vi.unstubAllEnvs();vi.restoreAllMocks();});
it('件数確認では鍵を必要とせず、書き込まず、件数だけ出力する',async()=>{
 process.argv=['node','script','--dry-run'];vi.stubEnv('MY_NUMBER_ENCRYPTION_KEY','');
 await import('../../../scripts/encrypt-my-numbers.mjs');
 expect(update).not.toHaveBeenCalled();expect(console.log).toHaveBeenCalledWith(JSON.stringify({dryRun:true,rootCount:1,onboardingCount:0}));
});
it('暗号化と平文の空欄化を同じ更新で行う',async()=>{
 process.argv=['node','script'];await import('../../../scripts/encrypt-my-numbers.mjs');
 expect(update).toHaveBeenCalledWith(expect.objectContaining({my_number:null,my_number_last4:'9018',my_number_cipher:expect.any(String)}));
 expect(JSON.stringify(update.mock.calls)).not.toContain('123456789018');
});
it('移行は非公開写真・平文禁止・監査・旧復号停止を定義する',()=>{
 const sql=readFileSync('supabase/migrations/20261029000479_my_number_encrypt.sql','utf8');
 expect(sql).toContain('as restrictive for all to anon,authenticated');
 expect(sql).toContain("raise exception 'plaintext my number is prohibited'");
 expect(sql).toContain('insert into public.my_number_access_logs');
 expect(sql).toContain('revoke all on function public.bud_decrypt_my_number');
 expect(sql.match(/\bcommit;/g)).toHaveLength(1);
});
