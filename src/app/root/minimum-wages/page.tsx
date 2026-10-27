"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "../_components/PageHeader";
import { Button } from "../_components/Button";
import { DataTable, type Column } from "../_components/DataTable";
import { Modal } from "../_components/Modal";
import ChangeConfirm from "@/app/system/_components/ChangeConfirm/ChangeConfirm";
import { useRootState } from "../_state/RootStateContext";
import { missingCurrentWage, type MinimumWage } from "@/lib/minimum-wages";
const empty=():MinimumWage=>({id:"",prefecture:"大阪府",hourly_amount:0,effective_from:"",source_url:"",updated_at:""});
const describe=(r:MinimumWage)=>`${r.prefecture}・${r.hourly_amount.toLocaleString("ja-JP")} 円・${r.effective_from} から・${r.source_url||"出典なし"}`;
export default function MinimumWagesPage(){
 const {gardenRole}=useRootState(); const writable=gardenRole==="super_admin";
 const [rows,setRows]=useState<MinimumWage[]>([]),[draft,setDraft]=useState<MinimumWage|null>(null),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[loaded,setLoaded]=useState(false);
 async function load(){try{const r=await fetch("/api/root/minimum-wages");const j=await r.json();if(!r.ok)throw new Error(j.error);setRows(j.rows);setLoaded(true);}catch{setMessage("最低賃金を読み込めませんでした");}}
 useEffect(()=>{void load();},[]);
 function review(){if(!writable||!draft)return;if(!draft.prefecture.trim()||!draft.effective_from||!Number.isInteger(draft.hourly_amount)||draft.hourly_amount<=0){setMessage("都道府県・時給・いつからを入力してください");return;}setConfirm(true);}
 async function save(){if(!draft||!writable)return;setBusy(true);try{const r=await fetch("/api/root/minimum-wages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)});const j=await r.json();if(!r.ok)throw new Error(j.error);setConfirm(false);setDraft(null);await load();}catch(e){setMessage(e instanceof Error?e.message:"保存できませんでした");setConfirm(false);}finally{setBusy(false);}}
 async function sync(){setBusy(true);try{const r=await fetch("/api/root/minimum-wages/sync",{method:"POST"});const j=await r.json();setMessage(j.ok?(j.added?`追加しました：${j.hourly_amount.toLocaleString("ja-JP")} 円（${j.effective_from} から）`:"新しい改定はありません"):j.error);if(j.ok)await load();}catch{setMessage("取り込めませんでした。時間をおいてお試しください");}finally{setBusy(false);}}
 const columns:Column<MinimumWage>[]=[
 {key:"prefecture",header:"都道府県",render:r=>r.prefecture},
 {key:"hourly",header:"時給",align:"right",render:r=>`${r.hourly_amount.toLocaleString("ja-JP")} 円`},
 {key:"from",header:"いつから",align:"center",render:r=>r.effective_from},
 {key:"source",header:"出典",render:r=>r.source_url?<a href={r.source_url} target="_blank" rel="noreferrer">出典を見る</a>:"—"},
 {key:"updated",header:"最終更新",render:r=>new Date(r.updated_at).toLocaleString("sv-SE",{timeZone:"Asia/Tokyo"})},
 ...(writable?[{key:"edit",header:"操作",render:(r:MinimumWage)=><Button variant="secondary" onClick={()=>setDraft({...r})}>修正</Button>}]:[])];
 return <div><PageHeader title="最低賃金マスタ" description="契約書と入社手続きで使う最低賃金です。" actions={writable?<div style={{display:"flex",gap:8}}><Button disabled={busy} onClick={()=>setDraft(empty())}>追加</Button><Button disabled={busy} variant="secondary" onClick={()=>void sync()}>厚生労働省から取り込む</Button></div>:undefined}/>
 {loaded&&missingCurrentWage(rows)&&<p role="status" style={{background:"#fef3c7",color:"#854d0e",padding:12}}>今年の最低賃金が未登録です。大阪労働局の発表を見て追加してください</p>}
 <DataTable columns={columns} rows={rows}/>
 <Modal open={!!draft&&!confirm} onClose={()=>{if(!busy)setDraft(null);}} onSubmit={review} title={draft?.id?"最低賃金を修正":"最低賃金を追加"}>
 {draft&&<div style={{display:"grid",gap:12}}><label>都道府県<input value={draft.prefecture} onChange={e=>setDraft({...draft,prefecture:e.target.value})}/></label><label>時給（円）<input type="number" min="1" step="1" value={draft.hourly_amount||""} onChange={e=>setDraft({...draft,hourly_amount:Number(e.target.value)})}/></label><label>いつから<input type="date" value={draft.effective_from} onChange={e=>setDraft({...draft,effective_from:e.target.value})}/></label><label>出典<input type="url" value={draft.source_url??""} onChange={e=>setDraft({...draft,source_url:e.target.value})}/></label><Button disabled={busy} onClick={review}>保存</Button></div>}</Modal>
 {confirm&&draft&&<ChangeConfirm title="最低賃金の保存" beforeLabel="変更前" before={rows.find(r=>r.id===draft.id)?describe(rows.find(r=>r.id===draft.id)!):"登録なし"} afterLabel="変更後" after={describe(draft)} question="この内容で保存しますか？" onClose={()=>{if(!busy)setConfirm(false);}} actions={<Button disabled={busy} onClick={()=>void save()}>保存する</Button>}/>}
 <Modal open={!!message} title="お知らせ" onClose={()=>setMessage("")}><p role="status">{message}</p><Button onClick={()=>setMessage("")}>閉じる</Button></Modal></div>;
}
