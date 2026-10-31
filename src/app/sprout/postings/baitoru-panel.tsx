"use client";
import Modal from "@/app/system/_components/Modal/Modal";
import ConfirmedDangerAction from "@/app/system/_components/Modal/ConfirmedDangerAction";
import RowActionButton from "@/app/system/_components/RowActionButton/RowActionButton";
import { useEffect,useState } from 'react';
import { loadBaitoru,saveBaitoru,retryBaitoru,createPosting,endPosting,cancelPosting,changeContentOption } from './baitoru-actions';
import { postingStatus, todayJst, type Posting } from '@/lib/sprout/postings';
import DataTable, { type DataColumn } from '@/app/system/_components/DataTable/DataTable';
import BoxSelect from '@/app/system/_components/BoxSelect/BoxSelect';
import styles from './baitoru.module.css';
type Data=Awaited<ReturnType<typeof loadBaitoru>>;
const reasons:Record<string,string>={inquiryNo_match:'問合せ番号が一致',batch_inquiryNo_dup:'今回の問合せ番号が重複',phone_name_period_match:'掲載期間内の電話と氏名が一致',batch_phone_name_dup:'今回の電話と氏名が重複',email_name_match:'メールと氏名が一致',kanji_birth_match:'氏名と生年月日が一致',kana_name_match:'最近のカナ氏名が一致'};
export default function BaitoruPanel() {
 const [data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [selected,setSelected]=useState<Posting|null>(null);
 const [excluded,setExcluded]=useState('');
 const [start,setStart]=useState(todayJst),[end,setEnd]=useState(todayJst),[content,setContent]=useState(''),[option,setOption]=useState('');
 const [today,setToday]=useState(todayJst);
 useEffect(()=>{const timer=setInterval(()=>setToday(todayJst()),30000);return()=>clearInterval(timer);},[]);
 async function reload() {const d=await loadBaitoru();setData(d);setExcluded(d.settings.exclude_inquiry_nos.join(','));}
 useEffect(()=>{let active=true;loadBaitoru().then(d=>{if(active){setData(d);setExcluded(d.settings.exclude_inquiry_nos.join(','));}}).catch(()=>{if(active)setMessage('読み込めませんでした。時間をおいてお試しください');});return()=>{active=false;};},[]);
 async function save() {
  if(!data)return;setBusy(true);setMessage('');
  try {await saveBaitoru({...data.settings,exclude_inquiry_nos:excluded.split(/[,、\s]+/).filter(Boolean)});await reload();setMessage('設定を保存しました');}
  catch {setMessage('保存できませんでした。設定の内容を確認してください');}finally{setBusy(false);}
 }
 async function retry(id:string) {setBusy(true);try {const r=await retryBaitoru(id);await reload();setMessage(r.ok?'もう一度知らせました':'知らせることができませんでした。時間をおいてお試しください');}catch{setMessage('知らせることができませんでした。時間をおいてお試しください');}finally{setBusy(false);}}
 const s=data?.settings;
 const update=(v:Partial<NonNullable<typeof s>>)=>setData(d=>d?{...d,settings:{...d.settings,...v}}:d);
 async function change(action:()=>Promise<unknown>,success:string) {
  setBusy(true);setMessage('');
  try {await action();await reload();setMessage(success);} catch {setMessage('保存できませんでした。内容を確認してください');} finally {setBusy(false);}
 }
 const columns:DataColumn<Posting>[]=[
  {id:'status',label:'状態', align: "mark",type:'text',value:p=>postingStatus(p,today)},
  {id:'period',label:'掲載期間', align: "fixed",type:'text',value:p=>`${p.start_date} ～ ${p.end_date}`},
  {id:'content',label:'掲載内容',type:'text',value:p=>p.content},
  {id:'created_at',label:'登録日',type:'date',value:p=>p.created_at,render:p=>new Date(p.created_at).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'})},
 ];
 return <section className={styles.panel} aria-label="バイトル取り込み">
  {selected && <Modal title="掲載の内容" onClose={()=>{if(!busy)setSelected(null);}} actions={<>{['掲載中','予定'].includes(postingStatus(selected,today)) && <ConfirmedDangerAction label={postingStatus(selected,today)==='掲載中'?'今すぐ終える':'取り消す'} disabled={busy} onConfirm={()=>change(()=>postingStatus(selected,today)==='掲載中'?endPosting(selected.id):cancelPosting(selected.id),'掲載を変更しました').then(()=>setSelected(null))}/>}<button onClick={()=>setSelected(null)} data-modal-action="secondary" disabled={busy}>閉じる</button></>}><p>{selected.start_date} ～ {selected.end_date}</p><p>{selected.content}</p><p>{postingStatus(selected,today)}</p></Modal>}
  {message && <p role="status">{message}</p>}
  {s && <><form onSubmit={e=>{e.preventDefault();void change(()=>createPosting(start,end,s.content_options.includes(content)?content:s.content_options[0] || ''),'掲載を登録しました');}}><h2>掲載の登録</h2><fieldset disabled={busy}>
   <label>掲載期間の開始<input required type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
   <span>～</span><label>掲載期間の終了<input required type="date" min={start} value={end} onChange={e=>setEnd(e.target.value)}/></label>
   <label>掲載内容<select required value={s.content_options.includes(content)?content:s.content_options[0] || ''} onChange={e=>setContent(e.target.value)}>{!s.content_options.length && <option value="">選択肢を追加してください</option>}{s.content_options.map(v=><option key={v}>{v}</option>)}</select></label><button type="submit" disabled={!s.content_options.length}>掲載する</button>
  </fieldset></form>
  <h2>掲載の一覧</h2><DataTable rows={data?.postings || []} columns={columns} rowKey={p=>p.id} searchPlaceholder="内容" searchText={p=>p.content} defaultSort={{id:'created_at',direction:'desc'}} onRowClick={p=>setSelected(p)}/>
  <form onSubmit={e=>{e.preventDefault();void change(()=>changeContentOption(option),'選択肢を追加しました');setOption('');}}><h2>掲載内容の選択肢</h2><fieldset disabled={busy}>{s.content_options.map(v=><span key={v}>{v} <RowActionButton kind="delete" label={`${v}を削除`} onClick={()=>void change(()=>changeContentOption(v,true),'選択肢を削除しました')} /> </span>)}<label>追加する文字<input required maxLength={200} value={option} onChange={e=>setOption(e.target.value)}/></label><button type="submit">追加</button></fieldset></form></>}
  {s && <div className={styles.card}><h2>取り込みの設定</h2><fieldset disabled={busy}>
   <legend>取り込み</legend><p>掲載期間中は自動で取り込み、期間が終わると止まります。</p>
   <label>今回だけ除外する問合せ番号（カンマ区切り）<input value={excluded} onChange={e=>setExcluded(e.target.value)}/></label>
   <label>通知先<select value={s.notify_room} onChange={e=>update({notify_room:e.target.value as 'dev'|'production'})}><option value="dev">開発ルーム</option><option value="production">本番ルーム</option></select></label>
   <BoxSelect label="通知の宛先" multiple options={data?.mention_candidates || []} value={s.mention_employee_ids} onChange={value=>update({mention_employee_ids:value})}/>
   <small>宛先に出るのは Root の従業員で Chatwork ID を入れた人です</small>
   <label>1回に登録する上限<input type="number" required min={1} max={100} value={s.max_per_run} onChange={e=>update({max_per_run:Number(e.target.value)})}/></label>
   <button type="button" className={styles.save} onClick={()=>void save()}>保存</button></fieldset><p>最後に届いた時刻：{s.last_called_at?new Date(s.last_called_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'まだ届いていません'}</p></div>}
  <h2>取り込みの記録</h2><div className={styles.history}><table><thead><tr>{['日時','読んだ行','新規','重複でとばし（理由別）','不足でとばし','対象外でとばし','次回に回す','通知の失敗','結果'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{data?.runs.map(r=><tr key={r.id}><td className="garden-cell-fixed">{new Date(r.started_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}</td><td className="garden-cell-number">{r.counts.totalRows || 0}</td><td className="garden-cell-number">{r.counts.added || 0}</td><td className="garden-cell-number">{Object.entries(r.dedup_by_reason).map(([k,v])=><div key={k}>{reasons[k] || '重複'}：{v}</div>)}</td><td className="garden-cell-number">{r.counts.missing || 0}</td><td className="garden-cell-number">{(r.counts.seed||0)+(r.counts.period||0)+(r.counts.excluded||0)}</td><td className="garden-cell-number">{r.counts.trimmed || 0}</td><td className="garden-cell-number">{r.counts.notifyFailed || 0}</td><td className="garden-cell-text">{r.error || '完了'}</td></tr>)}</tbody></table></div>
  <h2>通知できなかった応募</h2>{data?.failed.map(a=><p key={a.kintone_record_id}>{a.name}：{a.notify_error} <button className={styles.action} disabled={busy} onClick={()=>void retry(a.kintone_record_id)}>もう一度知らせる</button></p>)}
 </section>;
}
