import { beforeEach,afterEach,it,expect,vi } from 'vitest';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({access:vi.fn(),query:vi.fn(),resend:vi.fn()}));
vi.mock('@/lib/sprout/access.server',()=>({requireSproutUser:m.access}));
vi.mock('@/lib/auth/sprout-rill-view.server',()=>({requireRecruitMailRead:m.access}));
vi.mock('@/lib/db/pg',()=>({queryPg:m.query}));
vi.mock('@/lib/sprout/baitoru.server',()=>({resendBaitoru:m.resend}));
import { createPosting,endPosting,cancelPosting,changeContentOption,loadBaitoru,saveBaitoru,retryBaitoru } from './baitoru-actions';
beforeEach(()=>{vi.resetAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-24T15:00:00Z'));m.access.mockResolvedValue({id:'admin'});m.query.mockResolvedValue({rows:[{id:'p'}]});});
afterEach(()=>vi.useRealTimers());
it('authorizes every action before accessing data',async()=>{
 m.access.mockRejectedValue(new Error('閲覧権限がありません'));
 for(const action of [()=>createPosting('2026-11-01','2026-11-14','内容'),()=>endPosting('p'),()=>cancelPosting('p'),()=>changeContentOption('内容'),()=>loadBaitoru(),()=>saveBaitoru({} as never),()=>retryBaitoru('p')]) await expect(action()).rejects.toThrow('閲覧権限');
 expect(m.query).not.toHaveBeenCalled();expect(m.resend).not.toHaveBeenCalled();
});
it('validates dates and requires a registered content option when inserting',async()=>{
 await expect(createPosting('2026-11-14','2026-11-01','内容')).rejects.toThrow('掲載');
 expect(m.query).not.toHaveBeenCalled();
 await createPosting('2026-11-01','2026-11-14','テレマ正社員');
 expect(m.query).toHaveBeenCalledWith(expect.stringContaining('$3=any(content_options)'),['2026-11-01','2026-11-14','テレマ正社員','admin']);
 m.query.mockResolvedValue({rows:[]});await expect(createPosting('2026-11-01','2026-11-14','消した選択肢')).rejects.toThrow('選んで');
});
it('ends active postings only, using yesterday in Japan and recording early termination',async()=>{
 await endPosting('p');
 const [sql,args]=m.query.mock.calls[0];
 expect(sql).toContain('end_date=greatest(start_date,$2::date)');
 expect(sql).toContain('ended_early_at=now()');expect(sql).toContain('start_date<=$3::date and end_date>=$3::date and ended_early_at is null');
 expect(args).toEqual(['p','2026-10-24','2026-10-25']);
});
it('deletes only future unended postings at the Japan date boundary',async()=>{
 await cancelPosting('p');
 expect(m.query).toHaveBeenCalledWith('delete from sprout_baitoru_postings where id=$1 and start_date>$2::date and ended_early_at is null',['p','2026-10-25']);
});
it('keeps option removal separate from registered postings and rejects empty options',async()=>{
 await expect(changeContentOption(' ')).rejects.toThrow('掲載');expect(m.query).not.toHaveBeenCalled();
 await changeContentOption(' テレマ正社員 ',true);
 expect(m.query).toHaveBeenCalledWith(expect.stringContaining('content_options=array_remove'),['テレマ正社員','admin']);
 expect(m.query.mock.calls[0][0]).not.toContain('sprout_baitoru_postings');
});

const config = { enabled: true, period_start: '2026-09-22', chatwork_title: '応募', exclude_inquiry_nos: [], notify_room: 'dev' as const, mention_employee_ids: ['EMP-1'], max_per_run: 10 };
it.each([null, 'EMP-1', ['bad'], ['EMP-'], [123], Array(51).fill('EMP-1')])('rejects invalid recipients %j before writing', async value => {
 await expect(saveBaitoru({...config, mention_employee_ids:value as never})).rejects.toThrow('設定');
 expect(m.query).not.toHaveBeenCalled();
});
it('saves employee recipients and leaves legacy mentions untouched', async () => {
 await saveBaitoru(config);
 expect(m.query).toHaveBeenCalledWith(expect.stringContaining('mention_employee_ids=$3'), [[], 'dev', ['EMP-1'], 10, 'admin']);
 expect(m.query.mock.calls[0][0]).not.toMatch(/[, ]mentions=/);
});
it('loads active recipients and keeps selected unavailable people with their names', async () => {
 m.query.mockImplementation(async (sql:string) => ({rows:
  sql.includes('from sprout_baitoru_settings') ? [{...config, mention_employee_ids:['EMP-1','EMP-2','EMP-3']}] :
  sql.includes('is_active=true') ? [{employee_id:'EMP-1',name:'在籍 太郎'}] :
  sql.includes('employee_id=any') ? [{employee_id:'EMP-2',name:'退職 花子'}] : []
 }));
 const result=await loadBaitoru();
 expect(result.mention_candidates).toEqual([
  {value:'EMP-1',label:'在籍 太郎'},
  {value:'EMP-2',label:'退職 花子（ID 未登録）'},
  {value:'EMP-3',label:'氏名不明（ID 未登録）'},
 ]);
 expect(m.query.mock.calls.find(([sql])=>sql.includes('is_active=true'))?.[0]).toContain('deleted_at is null');
});