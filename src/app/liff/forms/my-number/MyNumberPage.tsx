'use client';
import Script from 'next/script';
import {useRef,useState} from 'react';
import {FormPage,ResultMessage} from '@/app/system/forms/_components/form-kit';
import MyNumberForm from '@/lib/my-number/MyNumberForm';
type Status = {my_number_last4:string;status:string;submitted_at:string;rejection_reason:string|null};
export default function MyNumberPage() {
 const id=process.env.NEXT_PUBLIC_LIFF_FORMS_ID;
 const started=useRef(false), token=useRef<string|null>(null);
 const [name,setName]=useState(''),[ready,setReady]=useState(false),[row,setRow]=useState<Status|null>(null),[message,setMessage]=useState(id?'確認中です':'準備中です');
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
 return <FormPage title={name?name+'さんのマイナンバーの提出':'マイナンバーの提出'} submitterName="" employeeNumber="" embedded>
 {ready?<MyNumberForm endpoint="/api/liff/my-number" authorization={'Bearer '+token.current} initialRow={row}/>:<ResultMessage>{message}</ResultMessage>}
 {id&&<Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" strategy="afterInteractive" onReady={()=>void initialize()} onError={()=>setMessage('確認できませんでした。')}/>}
 </FormPage>;
}
