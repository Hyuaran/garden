'use client';
import { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import DataTable, { type DataColumn } from '@/app/system/_components/DataTable/DataTable';
import Modal from '@/app/system/_components/Modal/Modal';
import HeaderViewToggle from '@/app/system/_components/HeaderViewToggle';
import { coinKeys, type Report } from './ap-daily-report';
import styles from './ApDailyReview.module.css';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);
const storageKey = 'garden.ap-daily-review.view';
const coinLabels = ['コイン作成数','誘導約束','誘導中','明細確認依頼','トータルコイン'];
const number = (n: number) => Number(n).toLocaleString('ja-JP');
const hours = (n: number) => `${(n / 60).toFixed(1)}時間`;
const time = (r: Report) => `${r.start_time.slice(0,5)}～${r.end_time.slice(0,5)}`;
const percent = (value: number, calls: number) => calls ? `${value.toFixed(1)}%` : '—';
export default function ApDailyReview({ recent, loading }: { recent: Report[]; loading: boolean }) {
  const [view,setView] = useState<'chart'|'table'>('chart');
  const [dark,setDark] = useState(false);
  const [selected,setSelected] = useState<Report|null>(null);
  useEffect(() => {
    try { if (localStorage.getItem(storageKey) === 'table') setView('table'); } catch {}
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const update = () => { const theme = document.documentElement.dataset.theme; setDark(theme === 'dark' || (theme !== 'light' && !!media?.matches)); };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    media?.addEventListener('change',update);
    return () => { observer.disconnect(); media?.removeEventListener('change',update); };
  },[]);
  const rows = [...recent].sort((a,b)=>a.report_date.localeCompare(b.report_date));
  const mixed = new Set(rows.map(r=>r.kind)).size > 1;
  const countLabel = mixed ? 'トス・獲得' : rows.at(-1)?.kind === 'toss' ? 'トス' : '獲得';
  const hasCloser = rows.some(r=>r.kind === 'closer');
  const columns: DataColumn<Report>[] = [
    {id:'date',label:'日付',type:'date',value:r=>r.report_date},
    {id:'time',label:'時間',type:'text',align:'fixed',value:time},
    {id:'hours',label:'稼働時間',type:'number',value:r=>r.work_minutes,render:r=>hours(r.work_minutes)},
    ...(['calls','absent','prospect','count','coin_created'] as const).map((key,i):DataColumn<Report>=>({id:key,label:['総コール','留守','見込み',countLabel,'コイン作成数'][i],type:'number',value:r=>r[key] ?? 0,render:r=>r[key] == null ? '—' : number(r[key])})),
    ...(['effective_rate','absent','prospect','count'] as const).map((key,i):DataColumn<Report>=>({id:`rate-${key}`,label:['有効率','留守率','見込み率',`${countLabel}率`][i],type:'number',value:r=>key === 'effective_rate' ? Number(r[key]) : r.calls ? r[key]/r.calls*100 : 0,render:r=>percent(key === 'effective_rate' ? Number(r[key]) : r[key]/r.calls*100,r.calls)})),
    ...(hasCloser ? [{id:'efficiency',label:'効率',type:'number' as const,value:(r:Report)=>r.efficiency,render:(r:Report)=>r.kind === 'closer' ? Number(r.efficiency).toFixed(2) : '—'}] : []),
  ];
  const colors = dark ? ['#93B8EA','#2DD4BF','#A9B8CC','#C4A7E7','#F095A5'] : ['#10233F','#0EA5A0','#64748B','#7856A0','#B9536B'];
  const ink = dark ? '#DFE8F5' : '#394B63';
  const grid = dark ? '#34455C' : '#DFE5ED';
  function summary(filtered: Report[]) {
    const sum = (key:'calls'|'absent'|'prospect'|'count'|'coin_created'|'work_minutes') => filtered.reduce((n,r)=>n+Number(r[key] ?? 0),0);
    const calls = sum('calls');
    const weighted = filtered.reduce((n,r)=>n+Number(r.effective_rate)*r.calls,0);
    return <div className={styles.summary} aria-label="合計"><strong>合計</strong><span>稼働時間 {hours(sum('work_minutes'))}</span>{(['calls','absent','prospect','count','coin_created'] as const).map((key,i)=><span key={key}>{['総コール','留守','見込み',countLabel,'コイン作成数'][i]} {number(sum(key))}</span>)}<span>有効率 {percent(weighted/calls,calls)}</span>{(['absent','prospect','count'] as const).map((key,i)=><span key={key}>{['留守率','見込み率',`${countLabel}率`][i]} {percent(sum(key)/calls*100,calls)}</span>)}{hasCloser && <span>効率 —</span>}</div>;
  }
  return <section className={styles.root}>
    <HeaderViewToggle><button type="button" aria-label={view === 'chart' ? '表で見る' : 'グラフで見る'} title={view === 'chart' ? '表で見る' : 'グラフで見る'} onClick={()=>{const next=view === 'chart' ? 'table':'chart';setView(next);try {localStorage.setItem(storageKey,next);} catch {}}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{view === 'chart' ? <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/></> : <><path d="M3 3v18h18M5 16l5-6 4 3 6-8"/></>}</svg></button></HeaderViewToggle>
    <p>直近31日（日報を送った日だけ）</p>
    {loading ? <p>読み込み中...</p> : !rows.length ? <p>まだありません</p> : view === 'chart' ? <div className={styles.chart}><Line aria-label="日報の推移" data={{labels:rows.map(r=>r.report_date.split('-').slice(1).map(Number).join('/')),datasets:(['calls','absent','prospect','count','coin_created'] as const).map((key,i)=>({label:['総コール','留守','見込み',countLabel,'コイン作成数'][i],data:rows.map(r=>r[key] ?? 0),yAxisID:i<2 ? 'y':'yRight',borderColor:colors[i],backgroundColor:colors[i],borderWidth:2,pointRadius:3}))}} options={{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{color:ink}},tooltip:{mode:'index',callbacks:{title:items=>rows[items[0]?.dataIndex]?.report_date ?? '',label:ctx=>`${rows[ctx.dataIndex].report_date}　${ctx.dataset.label} ${ctx.parsed.y}件`}}},scales:{x:{ticks:{color:ink},grid:{color:grid}},y:{beginAtZero:true,position:'left',title:{display:true,text:'件',color:ink},ticks:{precision:0,color:ink},grid:{color:grid}},yRight:{beginAtZero:true,position:'right',title:{display:true,text:'件',color:ink},ticks:{precision:0,color:ink},grid:{drawOnChartArea:false,color:grid}}}}}/></div> : <DataTable rows={rows} columns={columns} rowKey={r=>r.report_date} searchText={r=>r.report_date} searchPlaceholder="日付で探す" defaultSort={{id:'date',direction:'desc'}} summary={summary} onRowClick={setSelected}/>}
    {selected && <Modal title={`${selected.report_date} の日報`} size="md" onClose={()=>setSelected(null)} actions={<button type="button" onClick={()=>setSelected(null)}>閉じる</button>}><dl className={styles.details}>{[
      ['区分',selected.kind === 'toss' ? 'トス':'クローザー'],['時間',time(selected)],['稼働時間',hours(selected.work_minutes)],['総コール',`${number(selected.calls)}件`],['留守',`${number(selected.absent)}件`],['見込み',`${number(selected.prospect)}件`],['有効率',percent(Number(selected.effective_rate),selected.calls)],
      [selected.kind === 'toss' ? 'トス':'本日獲得',`${number(selected.count)}件`],...(selected.kind === 'closer' ? [['現状合計',`${Number(selected.month_total).toFixed(1)}件`],['効率',Number(selected.efficiency).toFixed(2)]]:[]),
      ...coinKeys.map((key,i)=>[coinLabels[i],selected[key] == null ? '記録なし':`${number(selected[key])}件`]),['反省点・改善点',selected.reflection],
    ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></Modal>}
  </section>;
}
