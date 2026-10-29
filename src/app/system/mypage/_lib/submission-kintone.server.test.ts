import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { syncSubmissionToKintone } from './submission-kintone.server';
import { queueRosterPush } from '@/app/root/_lib/roster-push.server';
import type { SubmissionRow } from './submission-types';
vi.mock('@/app/root/_lib/roster-push.server',()=>({getRosterDirection:vi.fn(async()=>'garden_to_kintone'),queueRosterPush:vi.fn(async()=>({status:'held'}))}));
beforeEach(()=>{
  vi.clearAllMocks();
  vi.stubEnv('KINTONE_SUBDOMAIN','mock');vi.stubEnv('KINTONE_EMPLOYEE_ROSTER_TOKEN','roster');
  vi.stubEnv('KINTONE_COMMUTE_TOKEN','commute');vi.stubEnv('KINTONE_PAYROLL_ACCOUNT_TOKEN','bank');
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({})})));
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it.each([['commute_route','93'],['bank_account','92']] as const)('queues %s while retaining app %s registration',async(type,app)=>{
  await syncSubmissionToKintone({employee_id:'EMP-1',submission_type:type,payload:{},proposed_one_way:100} as SubmissionRow,{name:'社員',kot_employee_id:'0001',commute_monthly_cap:1000});
  expect(queueRosterPush).toHaveBeenCalledWith('EMP-1','inbox');
  expect(fetch).toHaveBeenCalledTimes(1);
  const [,request]=vi.mocked(fetch).mock.calls[0];
  expect(request?.method).toBe('POST');expect(JSON.parse(String(request?.body)).app).toBe(app);
});
it('queues even without app credentials or a KOT ID',async()=>{
  await syncSubmissionToKintone({employee_id:'EMP-1',submission_type:'bank_account',payload:{}} as SubmissionRow,{name:'社員',kot_employee_id:null,commute_monthly_cap:null});
  expect(queueRosterPush).toHaveBeenCalledWith('EMP-1','inbox');expect(fetch).not.toHaveBeenCalled();
});
