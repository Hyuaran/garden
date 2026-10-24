import { dateKey } from './baitoru';
export type Posting = { id:string; start_date:string; end_date:string; content:string; created_at:string; ended_early_at:string|null };
export const todayJst = (now = new Date()) => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(now);
export const yesterdayJst = (now = new Date()) => new Date(Date.parse(`${todayJst(now)}T00:00:00Z`)-86400000).toISOString().slice(0,10);
export function postingStatus(p: Pick<Posting,'start_date'|'end_date'|'ended_early_at'>, today=todayJst()) {
 return p.ended_early_at || p.end_date<today ? '終了' : today<p.start_date ? '予定' : '掲載中';
}
export function postingContext(postings: Posting[], today=todayJst()) {
 const active=postings.filter(p=>postingStatus(p,today)==='掲載中');
 const latest=postings.filter(p=>postingStatus(p,today)==='終了').sort((a,b)=>b.end_date.localeCompare(a.end_date)||b.start_date.localeCompare(a.start_date))[0];
 const selected=active.length ? active : latest ? [latest] : [];
 const start=selected.map(p=>p.start_date).sort()[0] || today;
 const end=selected.map(p=>p.end_date).sort().at(-1) || today;
 const md=(d:string)=>`${Number(d.slice(5,7))}/${Number(d.slice(8,10))}`;
 return {enabled:active.length>0,period_start:start,chatwork_title:`【バイトル新規応募】${[...new Set(selected.map(p=>p.content))].join('・')} ${md(start)}～${md(end)}`};
}
export function validPosting(start:string,end:string,content:string) {
 return typeof start==='string' && typeof end==='string' && dateKey(start)===start && dateKey(end)===end && start<=end && typeof content==='string' && content.trim().length>0 && content.length<=200;
}
