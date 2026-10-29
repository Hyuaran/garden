// 本番では Claude が実行。番号・暗号文・鍵は出力しない。
import {createClient} from '@supabase/supabase-js';
import {encryptMyNumber,encryptOnboardingNumbers} from '../src/lib/my-number/crypto.mjs';
const dryRun=process.argv.includes('--dry-run');
if(process.argv.slice(2).some(arg=>arg!=='--dry-run')) throw new Error('Usage: node --env-file=.env.local scripts/encrypt-my-numbers.mjs [--dry-run]');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Database configuration is required');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
async function rows(table,columns) {
 const all=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await db.from(table).select(columns).order('employee_id').range(offset,offset+499);
  if(error)throw new Error('Read failed');all.push(...data);if(data.length<500)return all;
 }
}
let rootCount=0,onboardingCount=0,invalidCount=0;
// 12 桁と検査用の数字が合わない番号は暗号化したうえで「差し戻し」にし、確認の画面で直してもらう。
const validNumber=s=>{if(!/^\d{12}$/.test(s))return false;const d=s.split('').map(Number);let sum=0;for(let i=0;i<11;i++)sum+=d[10-i]*(i<6?i+2:i-4);const r=sum%11;return d[11]===(r<=1?0:11-r);};
for(const row of await rows('root_employee_my_numbers','employee_id,my_number,updated_at')) {
 if(!row.my_number)continue;rootCount++;
 const number=row.my_number.replace(/\D/g,''),ok=validNumber(number);if(!ok)invalidCount++;
 if(dryRun)continue;
 const {data,error}=await db.from('root_employee_my_numbers').update({...encryptMyNumber(number,{allowInvalid:!ok}),my_number:null,...(ok?{}:{status:'rejected',rejection_reason:'名簿の番号の形が正しくありません（12 桁・検査用の数字）。本人に提出し直してもらってください。'})}).eq('employee_id',row.employee_id).eq('updated_at',row.updated_at).select('employee_id');
 if(error||data.length!==1)throw new Error('Migration failed or concurrent update; rerun after stopping writers');
}
for(const row of await rows('system_onboarding','employee_id,my_number,my_number_secret,dependents,updated_at')) {
 const isPlain=value=>typeof value==='string'&&value!==''&&!/^••••••••\d{4}$/.test(value);
 const plain = isPlain(row.my_number) || (row.dependents||[]).some(item=>isPlain(item.my_number));
 if(!plain)continue;onboardingCount++;
 if(dryRun)continue;
 const protectedRow=encryptOnboardingNumbers(row,row);
 const {data,error}=await db.from('system_onboarding').update({my_number:protectedRow.my_number,my_number_secret:protectedRow.my_number_secret,dependents:protectedRow.dependents}).eq('employee_id',row.employee_id).eq('updated_at',row.updated_at).select('employee_id');
 if(error||data.length!==1)throw new Error('Migration failed or concurrent update; rerun after stopping writers');
}
console.log(JSON.stringify({dryRun,rootCount,invalidCount,onboardingCount}));
