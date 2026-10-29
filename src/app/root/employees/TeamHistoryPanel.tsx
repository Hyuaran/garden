'use client';
import { useEffect, useState } from 'react';
import Modal from '@/app/system/_components/Modal/Modal';
import DataTable from '@/app/system/_components/DataTable/DataTable';
import { FormRow, TextField, SelectField, TextArea, SubmitButton, ResultMessage, ActionButton } from '@/app/system/forms/_components/form-kit';
import { TEAMS, type TeamHistory } from '../_lib/team-history';

export default function TeamHistoryPanel({employeeId,canWrite,onChanged}:{employeeId:string;canWrite:boolean;onChanged:()=>void}) {
  const [rows,setRows]=useState<TeamHistory[]>([]);
  const [edit,setEdit]=useState<Partial<TeamHistory>>();
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const url=`/api/root/employees/${encodeURIComponent(employeeId)}/team-history`;
  useEffect(()=>{
    const abort=new AbortController();
    fetch(url,{signal:abort.signal,cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok || !Array.isArray(data.rows))throw new Error(data.error||'読み込めませんでした。');setRows(data.rows);}).catch(e=>{if(!abort.signal.aborted)setMessage(e.message);});
    return ()=>abort.abort();
  },[url]);
  async function save(method:'POST'|'PATCH'|'DELETE') {
    if(busy || !canWrite)return;
    setBusy(true);setMessage('');
    try {
      const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(edit)});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      setEdit(undefined);setMessage(data.warning||'登録しました。');
      const refreshed=await fetch(url,{cache:'no-store'});const result=await refreshed.json();if(!refreshed.ok)throw new Error(result.error);setRows(result.rows);onChanged();
    } catch(e){setMessage(e instanceof Error?e.message:'保存できませんでした。');}finally{setBusy(false);}
  }
  return <section><h3>チーム所属</h3>{canWrite&&<ActionButton onClick={()=>setEdit({effective_date:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}),team:'',memo:''})}>所属を追加する</ActionButton>}
    {message&&<ResultMessage>{message}</ResultMessage>}
    <DataTable rows={rows} rowKey={r=>r.id} searchText={r=>r.team+(r.memo||'')} defaultSort={{id:'date',direction:'desc'}} onRowClick={r=>setEdit({...r})} columns={[
      {id:'date',label:'移動日',type:'text',align:'fixed',value:r=>r.effective_date},
      {id:'team',label:'チーム',type:'text',value:r=>r.team},
      {id:'memo',label:'メモ',type:'text',wrap:true,value:r=>r.memo||'—'},
      {id:'by',label:'入力者',type:'text',value:r=>r.entered_by},
      {id:'at',label:'入力日時',type:'text',align:'fixed',value:r=>new Date(r.entered_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})},
    ]}/>
    {edit&&<Modal title={edit.id?'チーム所属':'所属を追加する'} onClose={()=>{if(!busy)setEdit(undefined);}}>
      {edit.source==='kintone'?<p>Kintone から取り込んだ行です</p>:<>
        <FormRow label="1 移動日"><TextField aria-label="移動日" type="date" disabled={!canWrite||busy} value={edit.effective_date||''} onChange={e=>setEdit({...edit,effective_date:e.target.value})}/></FormRow>
        <FormRow label="2 チーム"><SelectField aria-label="チーム" disabled={!canWrite||busy} value={edit.team||''} onChange={e=>setEdit({...edit,team:e.target.value})}>{TEAMS.map(t=><option key={t}>{t}</option>)}</SelectField></FormRow>
        <FormRow label="3 メモ"><TextArea aria-label="メモ" disabled={!canWrite||busy} maxLength={5000} value={edit.memo||''} onChange={e=>setEdit({...edit,memo:e.target.value})}/></FormRow>
        {canWrite&&<><SubmitButton busy={busy} onClick={()=>save(edit.id?'PATCH':'POST')}>{edit.id?'保存する':'登録する'}</SubmitButton>{edit.id&&<ActionButton disabled={busy} onClick={()=>save('DELETE')}>削除する</ActionButton>}</>}
      </>}{message&&<ResultMessage>{message}</ResultMessage>}
    </Modal>}
  </section>;
}
