import { expect,it } from 'vitest';
import { postingStatus,postingContext,todayJst,yesterdayJst,validPosting,type Posting } from './postings';
const posting=(start_date='2026-11-01',end_date='2026-11-14',content='テレマアルバイト'):Posting=>({id:'p',start_date,end_date,content,created_at:'2026-10-24T00:00:00Z',ended_early_at:null});
it('includes both boundaries and changes the day at midnight in Japan',()=>{
 const p=posting();
 expect(todayJst(new Date('2026-10-31T14:59:59Z'))).toBe('2026-10-31');
 expect(todayJst(new Date('2026-10-31T15:00:00Z'))).toBe('2026-11-01');
 expect(postingStatus(p,'2026-10-31')).toBe('予定');
 expect(postingStatus(p,'2026-11-01')).toBe('掲載中');
 expect(postingStatus(p,'2026-11-14')).toBe('掲載中');
 expect(postingStatus(p,'2026-11-15')).toBe('終了');
 expect(yesterdayJst(new Date('2026-10-31T15:00:00Z'))).toBe('2026-10-31');
});
it('runs if any posting is active and combines only active content and the outer dates',()=>{
 const posts=[posting(),posting('2026-11-05','2026-11-28','テレマ正社員'),posting('2026-12-01','2026-12-14','来月'),posting('2026-09-22','2026-10-05','過去')];
 expect(postingContext(posts,'2026-11-06')).toEqual({enabled:true,period_start:'2026-11-01',chatwork_title:'【バイトル新規応募】テレマアルバイト・テレマ正社員 11/1～11/28'});
 expect(postingContext(posts,'2026-11-20')).toMatchObject({enabled:true,period_start:'2026-11-05',chatwork_title:'【バイトル新規応募】テレマ正社員 11/5～11/28'});
 expect(postingContext(posts,'2026-10-24')).toMatchObject({enabled:false,period_start:'2026-09-22'});
 expect(postingContext([],'2026-10-24').enabled).toBe(false);
});
it('stops immediately even on the first day and retains the latest ended start for a trial',()=>{
 const ended={...posting(),end_date:'2026-11-01',ended_early_at:'2026-11-01T01:00:00Z'};
 expect(postingStatus(ended,'2026-11-01')).toBe('終了');
 expect(postingContext([ended],'2026-11-01')).toMatchObject({enabled:false,period_start:'2026-11-01'});
 expect(postingContext([ended,posting('2026-10-01','2026-10-14')],'2026-11-01').period_start).toBe('2026-11-01');
});
it('accepts only real ordered dates and nonempty bounded content',()=>{
 expect(validPosting('2026-11-01','2026-11-01','テレマ正社員')).toBe(true);
 for(const [start,end,content] of [['2026-11-02','2026-11-01','内容'],['2026-02-30','2026-03-01','内容'],['2026-11-01','2026-11-14',' '],['2026-11-01','2026-11-14','あ'.repeat(201)]]) expect(validPosting(start,end,content)).toBe(false);
});
