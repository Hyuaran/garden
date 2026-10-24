"use client";
import { useEffect,useState } from 'react';
import { loadBaitoru,saveBaitoru,retryBaitoru } from './baitoru-actions';
import styles from './baitoru.module.css';
type Data=Awaited<ReturnType<typeof loadBaitoru>>;
const reasons:Record<string,string>={inquiryNo_match:'問合せ番号が一致',batch_inquiryNo_dup:'今回の問合せ番号が重複',phone_name_period_match:'掲載期間内の電話と氏名が一致',batch_phone_name_dup:'今回の電話と氏名が重複',email_name_match:'メールと氏名が一致',kanji_birth_match:'氏名と生年月日が一致',kana_name_match:'最近のカナ氏名が一致'};
export default function BaitoruPanel() {
 const [data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [excluded,setExcluded]=useState('');
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
 return <section className={styles.panel} aria-label="バイトル取り込み">
  {message && <p role="status">{message}</p>}
  {s && <form onSubmit={e=>{e.preventDefault();void save();}}><h2>取り込みの設定</h2><fieldset disabled={busy}>
   <legend>取り込み</legend><label><input type="radio" name="enabled" checked={s.enabled} onChange={()=>update({enabled:true})}/>動かす</label><label><input type="radio" name="enabled" checked={!s.enabled} onChange={()=>update({enabled:false})}/>止める（掲載していない間は止める）</label>
   <label>掲載期間の開始日<input required type="date" value={s.period_start} onChange={e=>update({period_start:e.target.value})}/></label>
   <label>通知のタイトル<input required maxLength={500} value={s.chatwork_title} onChange={e=>update({chatwork_title:e.target.value})}/></label>
   <label>今回だけ除外する問合せ番号（カンマ区切り）<input value={excluded} onChange={e=>setExcluded(e.target.value)}/></label>
   <label>通知先<select value={s.notify_room} onChange={e=>update({notify_room:e.target.value as 'dev'|'production'})}><option value="dev">開発ルーム</option><option value="production">本番ルーム</option></select></label>
   <label>メンション<textarea value={s.mentions} onChange={e=>update({mentions:e.target.value})}/></label>
   <label>1回に登録する上限<input type="number" required min={1} max={100} value={s.max_per_run} onChange={e=>update({max_per_run:Number(e.target.value)})}/></label>
   <button type="submit">保存</button></fieldset><p>最後に届いた時刻：{s.last_called_at?new Date(s.last_called_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'まだ届いていません'}</p></form>}
  <h2>取り込みの記録</h2><div className={styles.history}><table><thead><tr>{['日時','読んだ行','新規','重複でとばし（理由別）','不足でとばし','対象外でとばし','次回に回す','通知の失敗','結果'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{data?.runs.map(r=><tr key={r.id}><td>{new Date(r.started_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}</td><td>{r.counts.totalRows || 0}</td><td>{r.counts.added || 0}</td><td>{Object.entries(r.dedup_by_reason).map(([k,v])=><div key={k}>{reasons[k] || '重複'}：{v}</div>)}</td><td>{r.counts.missing || 0}</td><td>{(r.counts.seed||0)+(r.counts.period||0)+(r.counts.excluded||0)}</td><td>{r.counts.trimmed || 0}</td><td>{r.counts.notifyFailed || 0}</td><td>{r.error || '完了'}</td></tr>)}</tbody></table></div>
  <h2>通知できなかった応募</h2>{data?.failed.map(a=><p key={a.kintone_record_id}>{a.name}：{a.notify_error} <button disabled={busy} onClick={()=>void retry(a.kintone_record_id)}>もう一度知らせる</button></p>)}
 </section>;
}
