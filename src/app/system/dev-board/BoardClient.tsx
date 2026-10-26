"use client";
import { useEffect, useState } from "react";
import SystemTabs, { TabActionButton } from "../_components/SystemTabs/SystemTabs";
import StepProgress from "../_components/StepProgress/StepProgress";
import DataTable, { type DataColumn } from "../_components/DataTable/DataTable";
import { ModuleIcon, MODULE_META } from "@/app/_components/ModuleIcon/ModuleIcon";
import type { GardenModuleId } from "@/app/_components/layout/GardenShell/garden-shell-config";
import { modules, statuses, orderedQuestions, type Question } from "./board";
import styles from "./board.module.css";
import Modal from "../_components/Modal/Modal";
import SystemBreadcrumb from "../_components/SystemBreadcrumb/SystemBreadcrumb";
const endpoint = "/api/system/dev-board";
async function post(body: unknown) { const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); const data=await r.json(); if(!r.ok) throw new Error(data.error); return data; }
function Icon({id}:{id:string}) { if(id!=="system" && id!=="common" && id!=="all") return <ModuleIcon id={id as GardenModuleId}/>; return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">{id==="system"?<><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/></>:id==="common"?<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18"/></>:<path d="M4 6h16M4 12h16M4 18h16"/>}</svg>; }
const moduleName=(id:string)=>modules.find(m=>m.id===id)?.name || id;
const date=(s:string|null)=>s?new Date(s).toLocaleString("ja-JP"):"";
export default function BoardClient({userId}:{userId?:string}) {
 const [rows,setRows]=useState<Question[]>([]),[tab,setTab]=useState("all"),[done,setDone]=useState(false),[error,setError]=useState(""),[adding,setAdding]=useState(false),[target,setTarget]=useState<string|null>(null);
 async function reload(){const r=await fetch(endpoint,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);setRows(d.questions);}
 useEffect(()=>{void reload().catch(e=>setError(e.message));},[]);
 useEffect(()=>{if(target && tab!=="all"){const card=document.getElementById(`question-${target}`);const group=card?.closest("details");if(group)group.open=true;card?.scrollIntoView?.({behavior:"smooth",block:"start"});card?.focus();setTarget(null);}},[target,tab,rows]);
 const visible=rows.filter(q=>done || q.status!=="done"), selected=rows.filter(q=>q.module===tab);
 const columns:DataColumn<Question>[]=[{id:"module",label:"モジュール",type:"text",value:q=>moduleName(q.module),render:q=><span className={styles.module}><Icon id={q.module}/>{moduleName(q.module)}</span>},{id:"title",label:"質問",type:"text",value:q=>q.title},{id:"status",label:"状態",type:"text",value:q=>statuses[q.status]},...([['created_at','作成日'],['answered_at','回答日'],['done_at','完了日']] as const).map(([id,label])=>({id,label,type:"date" as const,value:(q:Question)=>q[id]||"",render:(q:Question)=>date(q[id])}))];
 return <section className={styles.board}><SystemBreadcrumb items={[{label:"開発ボード"}]}/><header><h1>開発ボード</h1></header>
 <SystemTabs aria-label="モジュール" className={styles.tabs} actions={<TabActionButton label="質問を足す" icon="plus" pressed={adding} onClick={()=>setAdding(true)}/>}>{[{id:"all",name:"一覧"},...modules].map(m=><button role="tab" aria-selected={tab===m.id} key={m.id} disabled={m.id!=="all" && !rows.some(q=>q.module===m.id)} title={m.id==="system"?"社内システム":m.id==="common"?"共通（外部連携・インフラ）":m.id==="all"?"一覧":MODULE_META[m.id as GardenModuleId].role} onClick={()=>setTab(m.id)}><Icon id={m.id}/><small>{m.name}</small></button>)}</SystemTabs>
 {error && <p role="alert">{error}</p>}
 {tab==="all"?<DataTable rows={visible} columns={columns} rowKey={q=>q.id} searchText={q=>`${moduleName(q.module)} ${q.title} ${q.body} ${statuses[q.status]}`} defaultSort={{id:"created_at",direction:"desc"}} searchPlaceholder="モジュール・質問・状態" onRowClick={q=>{setTab(q.module);setTarget(q.id);}}/>:<><div className={styles.progress}><StepProgress total={selected.length} value={selected.filter(q=>q.status!=="open").length} name={selected.some(q=>q.status==="open")?`残り ${selected.filter(q=>q.status==="open").length}件（全${selected.length}件）`:`残りなし（全${selected.length}件）`} label={<>{selected.some(q=>q.status==="open")?<>残り <strong>{selected.filter(q=>q.status==="open").length}</strong>件</>:"残りなし"}（全{selected.length}件）</>}/></div>
 {orderedQuestions(selected.filter(q=>q.status==="open")).map(q=><QuestionCard key={q.id} q={q} saved={async warning=>{await reload();setError(warning || "");}}/>)}
 <QuestionGroup key={`${userId}:${tab}:answered`} title="回答済み" rows={selected.filter(q=>q.status==="answered" || q.status==="in_progress")} storageKey={userId?`dev-board:${userId}:${tab}:answered`:undefined} target={target} saved={async warning=>{await reload();setError(warning || "");}}/>
 {done && <QuestionGroup key={`${userId}:${tab}:done`} title="完了" rows={selected.filter(q=>q.status==="done")} storageKey={userId?`dev-board:${userId}:${tab}:done`:undefined} target={target} saved={async warning=>{await reload();setError(warning || "");}}/>}</>}
 <label className={styles.showDone}><input type="checkbox" checked={done} onChange={e=>setDone(e.target.checked)}/>完了も表示</label>
 {adding && <CreateQuestion close={()=>setAdding(false)} saved={async()=>{await reload();setAdding(false);}}/>}
 </section>;
}
function QuestionGroup({title,rows,storageKey,target,saved}:{title:string;rows:Question[];storageKey?:string;target:string|null;saved:(warning?:string)=>Promise<void>}) {
 const [open,setOpen]=useState(false);
 useEffect(()=>{try{setOpen(Boolean(storageKey && localStorage.getItem(storageKey)==="true"));}catch{}},[storageKey]);
 useEffect(()=>{if(target && rows.some(q=>q.id===target))setOpen(true);},[target,rows]);
 if(!rows.length)return null;
 return <details className={styles.group} open={open} onToggle={e=>{const next=e.currentTarget.open;setOpen(next);try{if(storageKey)localStorage.setItem(storageKey,String(next));}catch{}}}><summary><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><rect x="2" y="2" width="16" height="16" rx="2"/><path d="M5 10h10"/><path className={styles.plusVertical} d="M10 5v10"/></svg>{title}（{rows.length}件）</summary>{orderedQuestions(rows).map(q=><QuestionCard key={q.id} q={q} saved={saved}/>)}</details>;
}
function QuestionCard({q,saved}:{q:Question;saved:(warning?:string)=>Promise<void>}) {
 const [editing,setEditing]=useState(!q.answered_at),[choice,setChoice]=useState(q.answer_choice||""),[text,setText]=useState(""),[preview,setPreview]=useState<{raw:string;text:string;warning?:string}|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function prepare(){setBusy(true);setError("");try{setPreview(await post({action:"prepare",id:q.id,choice,text}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function send(answer:string){setBusy(true);try{const r=await post({action:"answer",id:q.id,choice,text,answer});await saved(r.warning);setPreview(null);setEditing(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <article id={`question-${q.id}`} tabIndex={-1} className={styles.card}><header><h2>{q.title}</h2><span className={styles.badge} data-status={q.status}>{statuses[q.status]}</span></header><p className={styles.body}>{q.body}</p>
 {q.answer_text && <p className={styles.body}>回答：{q.answer_text}</p>}
 {editing?<><fieldset disabled={busy}><legend>{q.answer_type==="choice"?"答えを選んでください":"回答を入力してください"}</legend>{q.answer_type==="choice" && q.options.map(o=><label className="garden-radio" key={o.key}><input type="radio" name={q.id} checked={choice===o.key} onChange={()=>setChoice(o.key)}/>{o.label}{o.recommended?"（おすすめ）":""}</label>)}<label>{q.answer_type==="choice"?"補足":"回答"}<textarea aria-label={q.answer_type==="choice"?"補足":"回答"} maxLength={10000} value={text} onChange={e=>setText(e.target.value)}/></label></fieldset><button className={styles.primary} disabled={busy} onClick={()=>void prepare()}>回答する</button></>:<button onClick={()=>{setEditing(true);setText(q.answer_text_raw?.split("\n").slice(q.answer_type==="choice"?1:0).join("\n") || "");}}>回答を直す</button>}
 {error && <p role="alert">{error}</p>}
 <details><summary><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2" y="2" width="16" height="16" rx="2"/><path d="M5 10h10"/><path className={styles.plusVertical} d="M10 5v10"/></svg>記録</summary>{[...q.system_dev_question_logs].sort((a,b)=>a.at.localeCompare(b.at)).map(l=><div key={l.id}><small>{date(l.at)} {l.actor} {l.action}</small><pre>{JSON.stringify(l.detail,null,2)}</pre></div>)}</details>
 {preview && <Modal title="この内容で送りますか" size="sm" onClose={()=>!busy && setPreview(null)}><p className={styles.body}>整えた文：{preview.text}</p><p className={styles.body}>もとの文：{preview.raw}</p>{preview.warning && <p role="status">{preview.warning}</p>}<div data-modal-actions><button data-modal-action="secondary" disabled={busy} onClick={()=>setPreview(null)}>直す</button><button data-modal-action="primary" disabled={busy} onClick={()=>void send(preview.raw)}>もとの文のまま送る</button><button data-modal-action="primary" disabled={busy} onClick={()=>void send(preview.text)}>整えた文で送る</button></div>{error && <p role="alert">{error}</p>}</Modal>}
 </article>;
}
function CreateQuestion({close,saved}:{close:()=>void;saved:()=>Promise<void>}) {
 const [error,setError]=useState(""),[busy,setBusy]=useState(false),[type,setType]=useState("text");
 return <Modal title="質問を足す" onClose={()=>!busy && close()}><form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError("");try{await post({action:"create",module:f.get("module"),title:f.get("title"),body:f.get("body"),answer_type:type,options:String(f.get("options")||"").split("\n").filter(Boolean).map((label,i)=>({key:String(i+1),label:label.replace(/^\*/,""),recommended:label.startsWith("*")}))});await saved();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><fieldset disabled={busy}><label>見出し<input name="title" required maxLength={300}/></label><label>モジュール<select name="module">{modules.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>説明<textarea name="body" maxLength={20000}/></label><label>答え方<select value={type} onChange={e=>setType(e.target.value)}><option value="text">文章</option><option value="choice">選択肢</option></select></label>{type==="choice" && <label>選択肢（1行に1つ・おすすめは先頭に *）<textarea name="options" required/></label>}<div data-modal-actions><button data-modal-action="secondary" type="button" onClick={close}>閉じる</button><button data-modal-action="primary">追加する</button></div></fieldset>{error && <p role="alert">{error}</p>}</form></Modal>;
}
