"use client";
import { useEffect, useState } from "react";
import Modal from "@/app/system/_components/Modal/Modal";
import ProfileTab from "@/app/system/mypage/tabs/ProfileTab";
import type { MyPageProfile } from "@/app/system/mypage/types";
import { SELF_CONFIRM_CATEGORIES } from "@/app/system/mypage/_lib/quarterly-confirm";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
export default function QuarterlyConfirm({onLock}: {onLock:(locked:boolean)=>void}) {
 const [status,setStatus]=useState<{required:boolean;confirmations:Record<string,string>;birthdayRegistered:boolean}|null>(null);
 const [error,setError]=useState(false);
 const [profile,setProfile]=useState<MyPageProfile|null>(null);
 const [remaining,setRemaining]=useState<number>(SELF_CONFIRM_CATEGORIES.length);
 useEffect(()=>{let active=true; async function load(){try{
 const response=await fetch("/api/system/mypage/quarterly-confirm",{cache:"no-store"});
 if(!response.ok)throw Error(); const result=await response.json();
 if(!active)return;setStatus(result);onLock(result.required);
 if(result.required&&!result.birthdayRegistered){const response=await fetch("/api/system/mypage/profile-current",{cache:"no-store"});if(!response.ok)throw Error();const data=await response.json();if(active)setProfile({...data.profile,confirmations:result.confirmations});}
 }catch{if(active)setError(true)}} void load();return()=>{active=false};},[onLock]);
 if(status&&!status.required)return null;
 return <Modal title="登録内容の確認（3か月ごと）" dismissible={false} onClose={()=>{}} actions={<><button type="button" onClick={async()=>{await createBrowserClient().auth.signOut();window.location.href="/login";}}>ログアウト</button><button type="button" disabled={!status||error||!profile||remaining>0} onClick={()=>{onLock(false);window.location.href="/my?tab=profile";}}>確認を終える</button></>}>
 <p>3か月に1回、登録している内容に変わりが無いか確認をお願いしています。</p><p>確認が終わるまで、ほかのタブは使えません。</p>
 {error?<p role="alert">登録内容を確認できませんでした。時間をおいて、画面を開き直してください。</p>:status?<ProfileTab confirmationOnly registered birthdayRegistered={status.birthdayRegistered} profile={profile} onRemaining={setRemaining} onUnlocked={next=>{
 setProfile(previous=>{
 const confirmations = {...status.confirmations,...previous?.confirmations};
 for (const [category,date] of Object.entries(next.confirmations ?? {})) if (!confirmations[category] || Date.parse(date)>Date.parse(confirmations[category])) confirmations[category]=date;
 return {...next,confirmations};
 });
 }}/>:<p role="status">確認中…</p>}
 </Modal>;
}
