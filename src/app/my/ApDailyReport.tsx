'use client';
import { useEffect, useRef, useState } from 'react';
import { FormPage, FormRow, RadioGroup, TextField, NumberField, TextArea, FixedValue, Stepper, SubmitButton, ResultMessage, TimeRange } from '@/app/system/forms/_components/form-kit';
import { buildMessage, coinKeys, fixedKind, minutes, type Report, type Kind } from './ap-daily-report';
import ApDailyReview from './ApDailyReview';
type Data = { record: Report | null; recent: Report[]; auto: Pick<Report,'start_time'|'end_time'|'work_minutes'|'calls'|'absent'|'prospect'|'effective_rate'> & Record<Kind,number>; totals: Record<Kind,number>; monthMinutes:number; employee:{name:string;number:string;kind:Kind|null} };
const labels = ['コイン作成数','誘導約束','誘導中','明細確認依頼','トータルコイン'];
export default function ApDailyReport({ history = false }: { history?: boolean }) {
  const [date,setDate] = useState(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo'}).format(new Date()));
  const [data,setData] = useState<Data|null>(null), [report,setReport] = useState<Report|null>(null);
  const [loading,setLoading] = useState(true), [busy,setBusy] = useState(false), [result,setResult] = useState(''), [success,setSuccess] = useState(false);
  const sending = useRef(false);
  const [recent,setRecent] = useState<Report[]>([]);
  useEffect(()=>{
    if (!history) return;
    // 振り返りは直近 31 日の日報だけ読む（入力用の集計を待たない）
    const controller = new AbortController(); setLoading(true); setResult('');
    fetch('/api/my/ap-daily-report?view=review',{signal:controller.signal}).then(async response=>{ const d = await response.json(); if (!response.ok) throw new Error(d.error); setRecent(d.recent ?? []); }).catch(e=>{if (!controller.signal.aborted) setResult(e.message || '日報を読み込めませんでした');}).finally(()=>{if (!controller.signal.aborted) setLoading(false);});
    return ()=>controller.abort();
  },[history]);
  useEffect(()=>{
    if (history) return;
    const controller = new AbortController(); setLoading(true); setReport(null); setResult('');
    fetch('/api/my/ap-daily-report?date='+date,{signal:controller.signal}).then(async response=>{ const d = await response.json(); if (!response.ok) throw new Error(d.error); return d as Data; }).then(d=>{
      setData(d);
      const kind = d.employee.kind ?? d.record?.kind ?? 'closer';
      setReport({...d.auto,...Object.fromEntries(coinKeys.map(k=>[k,null])),report_date:date,kind,employee_name:d.employee.name,auto_count:d.auto[kind],count:d.auto[kind],month_total:d.totals[kind],efficiency:0,reflection:'',sent_count:0,...d.record,start_time:(d.record?.start_time ?? d.auto.start_time).slice(0,5),end_time:(d.record?.end_time ?? d.auto.end_time).slice(0,5)} as Report);
    }).catch(e=>{if (!controller.signal.aborted) setResult(e.message || '日報を読み込めませんでした');}).finally(()=>{if (!controller.signal.aborted) setLoading(false);});
    return ()=>controller.abort();
  },[date,history]);
  function change(patch: Partial<Report>) { setReport(r=>r ? {...r,...patch} : r); }
  const monthlyMinutes = data && report ? data.monthMinutes-(data.record?.work_minutes ?? data.auto.work_minutes)+report.work_minutes : 0;
  const current = report && data ? {...report,calls:data.auto.calls,absent:data.auto.absent,prospect:data.auto.prospect,effective_rate:data.auto.effective_rate,efficiency:monthlyMinutes > 0 ? report.month_total/(monthlyMinutes/60) : 0} : null;
  async function submit() {
    if (sending.current || !current || loading) return;
    sending.current=true; setBusy(true); setResult(''); setSuccess(false);
    try {
      const response = await fetch('/api/my/ap-daily-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)});
      const d = await response.json(); if (!response.ok) throw new Error(d.error);
      setReport(d.report); setData(old=>old ? {...old,record:d.report,monthMinutes:monthlyMinutes,recent:[d.report,...old.recent.filter(r=>r.report_date !== date)].sort((a,b)=>b.report_date.localeCompare(a.report_date))} : old);
      setSuccess(!d.chatwork_error && !d.status_error);
      setResult(d.status_error ?? (d.chatwork_error ? `Garden には記録しました。Chatwork への投稿に失敗したので、もう一度［送信する］を押してください${d.chatwork_error === 'Chatwork の設定がありません' ? '（Chatwork の設定がありません）' : ''}` : '送信しました（Chatwork に投稿しました）'));
    } catch(e) { setResult(e instanceof Error ? e.message : '送信できませんでした'); }
    finally { sending.current=false; setBusy(false); }
  }
  return <FormPage embedded hideHeading title="AP日報" submitterName={data?.employee.name ?? ''} employeeNumber={data?.employee.number ?? ''}>
    {history ? <ApDailyReview recent={recent} loading={loading}/> : <>
      <FormRow grouped label="1 日付"><TextField aria-label="日付" type="date" value={date} disabled={busy} onChange={e=>{if(e.target.value) setDate(e.target.value);}} /></FormRow>
      {loading && <FixedValue>読み込み中...</FixedValue>}
      {current && data && <form onSubmit={e=>{e.preventDefault();void submit();}}><fieldset disabled={busy || loading}>
        <FormRow grouped label="2 区分">{fixedKind(data.employee.kind ?? '') ? <FixedValue>{current.kind === 'toss' ? 'トス' : 'クローザー'}</FixedValue> : <RadioGroup name="kind" label="区分" options={['トス','クローザー']} value={current.kind === 'toss' ? 'トス' : 'クローザー'} onChange={v=>{const kind=v === 'トス' ? 'toss':'closer';change({kind,count:data.auto[kind],auto_count:data.auto[kind],month_total:data.totals[kind]});}} />}</FormRow>
        <FormRow grouped label="3 時間"><TimeRange start={current.start_time} end={current.end_time} onStart={start_time=>change({start_time})} onEnd={end_time=>change({end_time})}><NumberField aria-label="稼働時間（分）" type="number" min={0} step={1} unit="分" value={current.work_minutes} onChange={e=>change({work_minutes:e.target.valueAsNumber})}/><FixedValue>{Number((current.work_minutes/60).toFixed(2))}時間稼働</FixedValue></TimeRange></FormRow>
        <FormRow grouped label="4 コール"><FixedValue>総コール{current.calls}件（留守{current.absent}件）（見込み{current.prospect}件）<br/>有効率{current.effective_rate.toFixed(1)}%<br/><small>コール履歴から</small></FixedValue></FormRow>
        <FormRow grouped label={current.kind === 'toss' ? '5 トス':'5 本日獲得'}><Stepper label={current.kind === 'toss' ? 'トス':'本日獲得'} value={current.count} onChange={count=>change({count,month_total:current.month_total+count-current.count})}/></FormRow>
        {current.kind === 'closer' && <FormRow grouped label="6 現状合計"><NumberField aria-label="現状合計" type="number" inputMode="decimal" pattern={undefined} min={0} step={0.1} unit="件" value={current.month_total} onChange={e=>change({month_total:e.target.valueAsNumber})}/><FixedValue>効率{current.efficiency.toFixed(2)}</FixedValue></FormRow>}
        <FormRow grouped label="7 コイン">{coinKeys.map((key,i)=><Stepper key={key} label={labels[i]} value={current[key] ?? 0} onChange={n=>change({[key]:n})}/>)}</FormRow>
        <FormRow grouped label="8 反省点・改善点"><TextArea aria-label="反省点・改善点" required maxLength={5000} value={current.reflection} onChange={e=>change({reflection:e.target.value})}/></FormRow>
        <FormRow grouped label="Chatwork に送る文" expanded><TextArea aria-label="Chatwork に送る文" readOnly rows={14} value={buildMessage(current,current.sent_count > 0)}/></FormRow>
        <SubmitButton type="submit" busy={busy} disabled={loading || !current.start_time || !current.end_time || minutes(current.end_time)<=minutes(current.start_time)}>送信する</SubmitButton>
      </fieldset></form>}
    </>}
    <ResultMessage success={success}>{result}</ResultMessage>
  </FormPage>;
}
