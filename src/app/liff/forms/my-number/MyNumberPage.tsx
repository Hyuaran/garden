'use client';
import Script from 'next/script';
import {useRef,useState,type FormEvent} from 'react';
import {FormPage,FormRow,FixedValue,TextField,SubmitButton,ResultMessage} from '@/app/system/forms/_components/form-kit';
import {validMyNumber} from '@/lib/my-number/validation';
type Status = {my_number_last4:string;status:string;submitted_at:string;rejection_reason:string|null};
const labels:Record<string,string> = {pending:'確認待ち',confirmed:'確認済み',rejected:'再提出をお願いします'};
export default function MyNumberPage() {
 const id=process.env.NEXT_PUBLIC_LIFF_FORMS_ID;
 const started=useRef(false), token=useRef<string|null>(null),lock=useRef(false);
 const [name,setName]=useState(''),[ready,setReady]=useState(false),[number,setNumber]=useState(''),[consent,setConsent]=useState(false),[photo,setPhoto]=useState<File|null>(null),[row,setRow]=useState<Status|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(id?'確認中です':'準備中です'),[success,setSuccess]=useState(false);
 async function initialize() {
  if(started.current||!id)return;started.current=true;
  try {
   const liff=(window as unknown as {liff:{init:(v:{liffId:string})=>Promise<void>;isInClient:()=>boolean;isLoggedIn:()=>boolean;getIDToken:()=>string|null}}).liff;
   await liff.init({liffId:id});
   if(!liff.isInClient()||!liff.isLoggedIn()){setMessage('LINE の中で開いてください。');return;}
   token.current=liff.getIDToken();
   const response=await fetch('/api/liff/my-number',{headers:{Authorization:'Bearer '+token.current},cache:'no-store'});
   const data=await response.json();if(!response.ok){setMessage(data.error||'この画面は従業員の方だけが使えます。');return;}
   setName(String(data.name).trim().split(/[\s　]+/)[0]);setRow(data.row);setReady(true);setMessage('');
  }catch{setMessage('確認できませんでした。時間をおいてもう一度お試しください。');}
 }
 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();if(lock.current)return;setSuccess(false);
  if(!consent||!validMyNumber(number)||!photo||!['image/jpeg','image/png'].includes(photo.type)||photo.size>5*1024*1024){setMessage('利用目的への同意、12桁の番号、5MBまでの写真を確認してください。');return;}
  lock.current=true;setBusy(true);const form=event.currentTarget;
  try {
   const data=new FormData();data.set('consent','true');data.set('my_number',number);data.set('photo',photo);
   const response=await fetch('/api/liff/my-number',{method:'POST',headers:{Authorization:'Bearer '+token.current},body:data});
   const result=await response.json();if(!response.ok){setMessage(result.error||'送信できませんでした。');return;}
   setRow(result.row);setNumber('');setPhoto(null);setConsent(false);form.reset();setSuccess(true);setMessage('送信しました。担当者が確認します。');
  }catch{setMessage('送信できませんでした。時間をおいてもう一度お試しください。');}finally{lock.current=false;setBusy(false);}
 }
 return <FormPage title={name?`${name}さんのマイナンバーの提出`:'マイナンバーの提出'} submitterName="" employeeNumber="" embedded>
 {ready&&<><FixedValue>利用目的：給与・社会保険・税の手続きのために使います。</FixedValue><form onSubmit={submit} data-clarity-mask="true">
 <label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>利用目的を確認しました</label>
 <FormRow label={<label htmlFor="my-number">1 マイナンバー（12桁）</label>}><TextField id="my-number" inputMode="numeric" autoComplete="off" pattern="[0-9]{12}" maxLength={12} required disabled={busy} value={number} onChange={e=>setNumber(e.target.value.replace(/\D/g,''))}/></FormRow>
 <FormRow label={<label htmlFor="my-number-photo">2 カードの写真</label>}><TextField id="my-number-photo" type="file" accept="image/jpeg,image/png" required disabled={busy} onChange={e=>setPhoto(e.target.files?.[0]||null)}/><FixedValue>マイナンバーカードの裏面または通知カード。JPEG・PNG、5MBまで。</FixedValue></FormRow>
 <SubmitButton type="submit" busy={busy} disabled={!consent}>送信する</SubmitButton></form>
 {row&&<FixedValue>提出の状況：{labels[row.status]}（{new Date(row.submitted_at).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'})}）　下4桁：{row.my_number_last4}{row.rejection_reason&&<><br/>{row.rejection_reason}</>}</FixedValue>}</>}
 <ResultMessage success={success}>{message}</ResultMessage>
 {id&&<Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" strategy="afterInteractive" onReady={()=>void initialize()} onError={()=>setMessage('確認できませんでした。')}/>}
 </FormPage>;
}
