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
let rootCount=0,onboardingCount=0;
for(const row of await rows('root_employee_my_numbers','employee_id,my_number,updated_at')) {
 if(!row.my_number)continue;rootCount++;
 if(dryRun)continue;
 const {data,error}=await db.from('root_employee_my_numbers').update({...encryptMyNumber(row.my_number),my_number:null}).eq('employee_id',row.employee_id).eq('updated_at',row.updated_at).select('employee_id');
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
console.log(JSON.stringify({dryRun,rootCount,onboardingCount}));
