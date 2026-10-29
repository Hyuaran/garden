'use client';
import Script from 'next/script';
import { useRef, useState, type FormEvent } from 'react';
import { FormPage, FormRow, RadioGroup, TextField, TextArea, FixedValue, SubmitButton, ResultMessage, RecentList } from '@/app/system/forms/_components/form-kit';
import { submissionFields } from '@/app/system/mypage/_lib/submission-fields';
import { validateSubmission, type SubmissionRow } from '@/app/system/mypage/_lib/submission-types';
type Kind = 'commute_route' | 'bank_account';
const labels: Record<Kind,string> = {commute_route:'通勤経路の変更',bank_account:'給与受取口座の変更'};
const statuses = {received:'受付',in_progress:'対応中',amount_proposing:'金額提案中',awaiting_employee:'本人確認待ち',completed:'完了',confirmed:'確認済み',withdrawn:'取り下げ'};
type Liff = {init:(options:{liffId:string})=>Promise<void>;isInClient:()=>boolean;isLoggedIn:()=>boolean;getIDToken:()=>string|null};
export default function FormsPage() {
 const id = process.env.NEXT_PUBLIC_LIFF_FORMS_ID;
 const started = useRef(false), submitting = useRef(false), token = useRef<string|null>(null);
 const [name,setName]=useState(''), [ready,setReady]=useState(false);
 const [message,setMessage]=useState(id?'確認中です':'準備中です');
 const [type,setType]=useState<Kind>('commute_route');
 const [drafts,setDrafts]=useState<Record<Kind,Record<string,string>>>({commute_route:{},bank_account:{}});
 const [rows,setRows]=useState<SubmissionRow[]>([]),[sending,setSending]=useState(false),[result,setResult]=useState(''),[success,setSuccess]=useState(false);
 async function initialize() {
  if (started.current || !id) return;
  started.current=true;
  try {
   const liff=(window as unknown as {liff:Liff}).liff;
   await liff.init({liffId:id});
   if (!liff.isInClient() || !liff.isLoggedIn()) {setMessage('LINE の中で開いてください');return;}
   token.current=liff.getIDToken();
   const response=await fetch('/api/liff/submissions',{headers:{Authorization:'Bearer '+(token.current||'')},cache:'no-store'});
   const data=await response.json();
   if (!response.ok) {setMessage(response.status===401||response.status===403?'この画面は従業員の方だけが使えます':data.error||'確認できませんでした。時間をおいてもう一度お試しください。');return;}
   setName(String(data.name).trim().split(/[\s　]+/)[0]);setRows(data.rows||[]);setReady(true);
  } catch {setMessage('確認できませんでした。時間をおいてもう一度お試しください。');}
 }
 async function submit(event:FormEvent) {
  event.preventDefault();if(submitting.current)return;
  const error=validateSubmission(type,drafts[type]);setSuccess(false);setResult(error||'');if(error)return;
  submitting.current=true;setSending(true);
  try {
   const response=await fetch('/api/liff/submissions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token.current},body:JSON.stringify({submission_type:type,payload:drafts[type]})});
   const data=await response.json();if(!response.ok){setResult(data.error||'送信できませんでした。');return;}
   setRows(previous=>[data.row,...previous].slice(0,10));setDrafts(previous=>({...previous,[type]:{}}));setSuccess(true);setResult('送信しました。担当者が確認します。');
  } catch {setResult('送信できませんでした。時間をおいてもう一度お試しください。');}
  finally {submitting.current=false;setSending(false);}
 }
 return <div style={{maxWidth:560,margin:'0 auto',padding:16}}><FormPage title={name?name+'さんの申告':'申告'} submitterName="" employeeNumber="" embedded>
 {!ready?<FixedValue>{message}</FixedValue>:<><form onSubmit={submit}>
 <FormRow label="1 申告の種類"><RadioGroup name="submission-type" label="申告の種類" options={Object.values(labels)} value={labels[type]} onChange={value=>{if(!sending){setType(value===labels.commute_route?'commute_route':'bank_account');setResult('');}}}/></FormRow>
 {submissionFields[type].map(([key,label,input,optional],index)=><FormRow key={key} label={<label htmlFor={'submission-'+key}>{index+2} {label}</label>}>
 {input==='textarea'?<TextArea id={'submission-'+key} value={drafts[type][key]||''} disabled={sending} onChange={e=>setDrafts({...drafts,[type]:{...drafts[type],[key]:e.target.value}})}/>:<TextField id={'submission-'+key} type={input} required={!optional} disabled={sending} value={drafts[type][key]||''} onChange={e=>setDrafts({...drafts,[type]:{...drafts[type],[key]:e.target.value}})}/>}
 </FormRow>)}
 {type==='bank_account'&&<FixedValue>種別は「普通」で受け付けます。</FixedValue>}
 <SubmitButton type="submit" busy={sending}>送信する</SubmitButton><ResultMessage success={success}>{result}</ResultMessage>
 </form><RecentList title="これまでの申告" items={rows.map(row=><p key={row.id}>{new Date(row.created_at).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'})}　{labels[row.submission_type as Kind]}　{statuses[row.status]}</p>)}/></>}
 {id&&<Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" strategy="afterInteractive" onReady={()=>{void initialize();}} onError={()=>setMessage('確認できませんでした。時間をおいてもう一度お試しください。')}/>}
 </FormPage></div>;
}
