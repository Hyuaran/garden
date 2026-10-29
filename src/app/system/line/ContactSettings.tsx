'use client';
import { useState } from 'react';
import DataTable from '../_components/DataTable/DataTable';
import Modal from '../_components/Modal/Modal';
import { ActionButton, FormRow, TextField, SubmitButton, ResultMessage } from '../forms/_components/form-kit';
import { groupLabels, menuGroup, validContactUrl, type Contact, type MenuGroup } from '@/lib/line/richmenu';
import type { Employee, Tag, Member } from '@/lib/line/tags';
type Data = { contacts: Contact[]; menus: { group_key: MenuGroup; richmenu_id: string; created_at: string; applied_at:string|null }[]; employees: Employee[]; tags: Tag[]; members: Member[] };
export default function ContactSettings({ data, busy, act }: { data: Data; busy: boolean; act: (payload: object) => Promise<unknown> }) {
  const [edit, setEdit] = useState<Contact>();
  const [error, setError] = useState('');
  return <>
    <DataTable defaultSort={{id:'name',direction:'asc'}} rows={data.contacts} rowKey={c=>c.key} searchText={c=>c.label} columns={[
      { id:'name',label:'連絡先',type:'text',value:c=>c.label },
      { id:'url',label:'リンク',type:'text',value:c=>c.url||'未登録' },
      { id:'change',label:'変更',type:'text',value:()=>'',render:c=><ActionButton disabled={busy} onClick={()=>{setEdit({...c});setError('');}}>変更する</ActionButton> },
    ]}/>
    <SubmitButton busy={busy} onClick={()=>act({action:'applyMenus'})}>リッチメニューに反映する</SubmitButton>
    <h2>今のメニュー</h2>
    <DataTable defaultSort={{id:'group',direction:'asc'}} rows={data.menus} rowKey={r=>r.richmenu_id} searchText={r=>groupLabels[r.group_key]} columns={[
      { id:'group',label:'組み合わせ',type:'text',value:r=>groupLabels[r.group_key] },
      { id:'count',label:'人数',type:'number',value:r=>data.employees.filter(e=>menuGroup(e,data.tags,data.members)===r.group_key).length },
      { id:'date',label:'最後に反映した日時',type:'text',align:'fixed',value:r=>new Date(r.applied_at||r.created_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}) },
    ]}/>
    {edit&&<Modal title={edit.label+'の連絡先'} onClose={()=>setEdit(undefined)} actions={<SubmitButton busy={busy} onClick={async()=>{
      if(!validContactUrl(edit.key,edit.url.trim())) { setError(edit.key==='guest_home'?'https で始まるリンクを入力してください。':'LINE のリンクを入力してください'); return; }
      if(await act({action:'contact',key:edit.key,url:edit.url}))setEdit(undefined);
      else setError('登録できませんでした。入力したリンクを確認してください。');
    }}>登録する</SubmitButton>}>
      <FormRow label="リンク"><TextField aria-label="連絡先のリンク" type="url" maxLength={2000} value={edit.url} onChange={e=>setEdit({...edit,url:e.target.value})}/></FormRow>
      <p>登録後に「リッチメニューに反映する」を押してください。</p>
      <ResultMessage>{error}</ResultMessage>
    </Modal>}
  </>;
}
