'use client';
import { useState } from 'react';
import DataTable from '../_components/DataTable/DataTable';
import Modal from '../_components/Modal/Modal';
import { FormRow, TextField, SelectField, SubmitButton, ResultMessage, ActionButton, ActionRow } from '../forms/_components/form-kit';
import { validContactUrl, contactRows, contactName, type Contact } from '@/lib/line/richmenu';
import { statusOf, type Employee } from '@/lib/line/tags';
export default function ContactSettings({data,busy,act}:{data:{contacts:Contact[];employees:Employee[]};busy:boolean;act:(payload:object)=>Promise<unknown>}) {
 const [edit,setEdit]=useState<Contact>(); const [adding,setAdding]=useState(false); const [confirm,setConfirm]=useState(false); const [error,setError]=useState('');
 const rows=contactRows(data.employees,data.contacts);
 const available=data.employees.filter(e=>statusOf(e)==='在籍中'&&!e.line_contact_url);
 const assigned=edit&&data.contacts.some(c=>c.employee_id===edit.employee_id&&edit.employee_id);
 async function save(url:string,remove=false) {
  if(!edit)return;
  if((adding&&!edit.employee_id)||(!url.trim()&&edit.key!=='guest_home'&&!remove)||!validContactUrl(edit.key,url.trim())){setError('氏名とリンクを確認してください。');return;}
  if(await act(edit.key==='guest_home'?{action:'contact',key:edit.key,url}:{action:'employeeContact',employeeId:edit.employee_id,url}))setEdit(undefined);
  else setError('登録できませんでした。入力した内容を確認してください。');
 }
 return <>
 <ActionRow><ActionButton disabled={busy} onClick={()=>{setAdding(true);setConfirm(false);setError('');setEdit({key:'',label:'',url:'',updated_at:'',updated_by:null});}}>連絡先を追加する</ActionButton></ActionRow>
 <DataTable rows={rows} rowKey={c=>c.key} searchText={c=>c.label+c.url} defaultSort={{id:'name',direction:'asc'}} columns={[
 {id:'name',label:'氏名',type:'text',value:c=>c.label},{id:'url',label:'リンク',type:'text',value:c=>c.url||'未登録'}
 ]} onRowClick={c=>{setAdding(false);setConfirm(false);setError('');setEdit({...c});}}/>
 {edit&&<Modal title={adding?'連絡先を追加する':edit.label+'の連絡先'} onClose={()=>setEdit(undefined)} actions={<>
 {!adding&&edit.key!=='guest_home'&&<ActionButton disabled={busy||!!assigned} style={{color:'#e5484d',borderColor:'#e5484d'}} onClick={()=>setConfirm(true)}>連絡先から外す</ActionButton>}
 <SubmitButton busy={busy} onClick={()=>save(edit.url)}>登録する</SubmitButton></>}>
 {adding&&<FormRow label="1 氏名"><SelectField aria-label="氏名" value={edit.employee_id||''} onChange={e=>setEdit({...edit,employee_id:e.target.value,key:e.target.value})}>{available.map(e=><option key={e.employee_id} value={e.employee_id}>{contactName(e.name)}</option>)}</SelectField></FormRow>}
 <FormRow label={adding?'2 リンク':'リンク'}><TextField aria-label="連絡先のリンク" type="url" maxLength={2000} value={edit.url} onChange={e=>setEdit({...edit,url:e.target.value})}/></FormRow>
 <p>登録したら、リッチメニュータブの［リッチメニューに反映する］を押してください。</p>
 {assigned&&<p>先にリッチメニュータブで担当を変更してください。</p>}<ResultMessage>{error}</ResultMessage>
 </Modal>}
 {confirm&&edit&&<Modal title="連絡先から外す" onClose={()=>setConfirm(false)} actions={<ActionButton disabled={busy} style={{color:'#e5484d',borderColor:'#e5484d'}} onClick={async()=>{await save('',true);setConfirm(false);}}>連絡先から外す</ActionButton>}><p>{edit.label}を連絡先から外しますか。</p></Modal>}
 </>;
}
