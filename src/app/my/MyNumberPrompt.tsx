'use client';
import {useEffect,useState} from 'react';
import Modal from '@/app/system/_components/Modal/Modal';
import MyNumberForm,{type MyNumberStatus} from '@/lib/my-number/MyNumberForm';
export default function MyNumberPrompt({locked,profile}:{locked:boolean;profile:boolean}){
 const [status,setStatus]=useState<{row:MyNumberStatus|null;prompt:boolean}|null>(null);
 const [editing,setEditing]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/system/mypage/my-number',{cache:'no-store'}).then(async response=>{if(!response.ok)throw Error();const result=await response.json();if(active)setStatus(result);}).catch(()=>{if(active)setError('提出の状況を読み込めませんでした。画面を開き直してください。');});return()=>{active=false};},[]);
 async function defer(){if(saving)return;setSaving(true);try{const response=await fetch('/api/system/mypage/my-number',{method:'PATCH'});if(!response.ok)throw Error();setStatus(previous=>previous&&({...previous,prompt:false}));setError('');}catch{setError('記録できませんでした。もう一度お試しください。');}finally{setSaving(false);}}
 const row=status?.row,needed=status&&(!row||row.status==='rejected');
 return <>
 {profile&&<div>マイナンバー：{status?(needed?(row?'差し戻し':'未提出'):`提出済み（${row?.status==='confirmed'?'確認済み':'確認待ち'}）・下4桁 ${row?.my_number_last4}`):'確認中'} {needed&&<button type="button" onClick={()=>setEditing(true)}>提出する</button>}{error&&<p role="alert">{error}</p>}</div>}
 {!locked&&editing?<Modal title="マイナンバーの提出" onClose={()=>setEditing(false)}><MyNumberForm endpoint="/api/system/mypage/my-number" initialRow={row} onSubmitted={next=>{setStatus({row:next,prompt:false});}}/></Modal>:!locked&&status?.prompt&&<Modal title="マイナンバーの提出のお願い" size="sm" onClose={()=>void defer()} actions={<><button type="button" disabled={saving} onClick={()=>void defer()}>あとで</button><button type="button" onClick={()=>setEditing(true)}>提出する</button></>}><p>給与・社会保険・税の手続きのため、マイナンバーの提出をお願いします。</p>{row?.rejection_reason&&<p>理由：{row.rejection_reason}</p>}{error&&<p role="alert">{error}</p>}</Modal>}
 </>;
}
