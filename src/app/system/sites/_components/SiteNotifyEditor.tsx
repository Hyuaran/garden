"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import Modal from "@/app/system/_components/Modal/Modal";
import BoxSelect from "@/app/system/_components/BoxSelect/BoxSelect";
import { FormRow, SubmitButton, ResultMessage, ActionButton } from "@/app/system/forms/_components/form-kit";
import type { NotifyState } from "@/lib/sites/notify";
import { saveNotifyRecipients } from "../notify-actions";
import type { CorporateSite } from "../_lib/sites-registry";
const Context=createContext<{open:(site:CorporateSite)=>void; names:(site:CorporateSite)=>string}>({open:()=>{},names:s=>s.chatwork_to?.join("・") ?? ""});
export const useSiteNotify=()=>useContext(Context);
export default function SiteNotifyEditor({initial,canEdit,children}:{initial?:NotifyState;canEdit:boolean;children:ReactNode}){
 const [state,setState]=useState(initial),[site,setSite]=useState<CorporateSite|null>(null),[ids,setIds]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const names=(s:CorporateSite)=>state ? (state.recipients[s.notify_key ?? ""] ?? []).map(id=>state.employees.find(e=>e.value===id)?.label).filter(Boolean).join("・") || "未登録" : initial===undefined ? "読み込めませんでした" : "未登録";
 const open=(s:CorporateSite)=>{if(!s.notify_key)return;setSite(s);setIds((state?.recipients[s.notify_key] ?? []).filter(id=>state?.employees.some(e=>e.value===id)));setError("");};
 async function save(){
 if(busy || !site || !canEdit || !state)return;
 setBusy(true);setError("");
 try{await saveNotifyRecipients(site.notify_key!,ids);setState({...state,recipients:{...state.recipients,[site.notify_key!]:ids}});setSite(null);}
 catch{setError("通知先を登録できませんでした。時間をおいてもう一度お試しください。");}
 finally{setBusy(false);}
 }
 return <Context.Provider value={{open,names}}>{children}{site && <Modal title={site.company+" "+(site.product ?? site.kind)+"のお問い合わせ通知の TO"} onClose={()=>{if(!busy)setSite(null);}}>
 {canEdit && state ? <><FormRow label="1 通知先"><BoxSelect label="通知先" hideLabel value={ids} options={state.employees} onChange={setIds}/></FormRow>
 <p>Root で Chatwork の番号を登録してください。在籍中で番号のある人を選べます。</p>
 <ActionButton disabled={busy} onClick={()=>setIds([])}>通知先を空にする</ActionButton>
 <SubmitButton type="button" busy={busy} onClick={save}>登録する</SubmitButton>{error && <ResultMessage>{error}</ResultMessage>}</> : <p>TO {names(site)}</p>}
 </Modal>}</Context.Provider>;
}
