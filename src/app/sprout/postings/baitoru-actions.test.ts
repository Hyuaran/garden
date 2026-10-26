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
