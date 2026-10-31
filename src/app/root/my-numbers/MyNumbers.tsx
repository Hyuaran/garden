'use client';
import HelpButton from "@/app/system/_components/HelpButton/HelpButton";
import {useRef,useState} from 'react';
import {useSearchParams,useRouter,usePathname} from 'next/navigation';
import DataTable,{type DataColumn} from '@/app/system/_components/DataTable/DataTable';
import Modal from '@/app/system/_components/Modal/Modal';
import SystemTabs from '@/app/system/_components/SystemTabs/SystemTabs';
import SystemBreadcrumb from '@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb';
import {TextArea,ResultMessage} from '@/app/system/forms/_components/form-kit';
import type {MyNumberRow} from '@/lib/my-number/review.server';
import styles from './my-numbers.module.css';
const labels:Record<string,string>={pending:'確認待ち',rejected:'差し戻し',confirmed:'確認済み',missing:'未提出'};
const date=(value:string)=>value?new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'記録なし';
export default function MyNumbers({rows:initial}: {rows:MyNumberRow[]}) {
 const [rows,setRows]=useState(initial),[selected,setSelected]=useState<MyNumberRow|null>(null),[number,setNumber]=useState(''),[photo,setPhoto]=useState(''),[reason,setReason]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const lock=useRef(false),generation=useRef(0);
 const params=useSearchParams(),router=useRouter(),pathname=usePathname();
 const tab=Object.keys(labels).includes(params.get('tab')||'')?params.get('tab')!:'pending';
 function close(){generation.current++;setSelected(null);setNumber('');setPhoto('');setReason('');setMessage('');}
 async function action(action:string,row=selected) {
  if(!row||lock.current)return;lock.current=true;setBusy(true);setMessage('');const current=++generation.current;
  try {
   const response=await fetch('/api/root/my-numbers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,employee_id:row.employee_id,submitted_at:row.submitted_at,reason}),cache:'no-store'});
   const result=await response.json();if(current!==generation.current)return;
   if(!response.ok){setMessage(result.error||'操作を完了できませんでした。');return;}
   if(action==='display')setNumber(result.number);
   else if(action==='detail')setPhoto(result.photoUrl||'');
   else {setRows(previous=>previous.map(item=>item.employee_id===row.employee_id?{...item,status:action==='confirm'?'confirmed':'rejected',rejection_reason:action==='reject'?reason:''}:item));close();if(action==='reject')setMessage(result.notification==='sent'?'差し戻し、LINE にお知らせしました。':result.notification==='failed'?'差し戻しました。LINE へのお知らせに失敗しました。':'差し戻しました。LINE へのお知らせは停止中です。');}
  }catch{if(current===generation.current)setMessage('操作を完了できませんでした。');}finally{lock.current=false;setBusy(false);}
 }
 const columns:DataColumn<MyNumberRow>[]=[{id:'employee_number',label:'社員番号',type:'text',align:'fixed',value:row=>row.employee_number||row.employee_id},{id:'name',label:'氏名',type:'text',value:row=>row.name||'記録なし'},{id:'submitted_at',label:'提出日時',type:'date',align:'fixed',value:row=>row.submitted_at,render:row=>date(row.submitted_at)},{id:'number',label:'番号',type:'text',align:'fixed',value:row=>row.last4?'****-****-'+row.last4:'未提出'}];
 return <main className={styles.pageShell}><SystemBreadcrumb root={{label:'Root',href:'/root'}} items={[{label:'マイナンバー'}]}/><div className="garden-help-heading"><h1>マイナンバー</h1><HelpButton /></div>
 <SystemTabs>{Object.entries(labels).map(([key,label])=><button key={key} type="button" role="tab" aria-selected={tab===key} onClick={()=>{const next=new URLSearchParams(params);next.set('tab',key);router.replace(pathname+'?'+next.toString(),{scroll:false});}}>{label} <span>{rows.filter(row=>row.status===key).length}</span></button>)}</SystemTabs>
 <ResultMessage>{message}</ResultMessage><DataTable rows={rows.filter(row=>row.status===tab)} columns={columns} rowKey={row=>row.employee_id} searchText={row=>`${row.employee_number} ${row.name}`} searchPlaceholder="社員番号・氏名" defaultSort={{id:'submitted_at',direction:'desc'}} onRowClick={row=>{if(busy)return;setSelected(row);setNumber('');setPhoto('');setReason('');setMessage('');if(row.last4)void action('detail',row);}}/>
 {selected&&<Modal title={selected.name||'マイナンバー'} onClose={close} actions={selected.last4&&<><button disabled={busy} className={styles.danger} onClick={()=>void action('reject')}>差し戻す</button><button disabled={busy} className={styles.primary} onClick={()=>void action('confirm')}>確認しました</button></>}><div data-clarity-mask="true"><p>提出日時：{date(selected.submitted_at)}</p><p>番号：{number||(selected.last4?'****-****-'+selected.last4:'未提出')}</p>{selected.last4&&<button disabled={busy} onClick={()=>void action('display')}>表示する</button>}
 <p>{selected.source==='roster'?'写真なし・名簿から':selected.hasPhoto?'提出された写真':'写真なし'}</p>{photo&&<img src={photo} alt="提出されたカードの写真" className={styles.photo} referrerPolicy="no-referrer"/>}
 <label htmlFor="return-reason">差し戻す理由</label><TextArea id="return-reason" maxLength={1000} value={reason} disabled={busy} onChange={event=>setReason(event.target.value)}/>{selected.rejection_reason&&<p>前回の差し戻し：{selected.rejection_reason}</p>}<ResultMessage>{message}</ResultMessage></div></Modal>}
 </main>;
}
