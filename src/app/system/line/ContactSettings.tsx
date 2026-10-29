'use client';
import { useState } from 'react';
import DataTable from '../_components/DataTable/DataTable';
import Modal from '../_components/Modal/Modal';
import { FormRow, TextField, SubmitButton, ResultMessage } from '../forms/_components/form-kit';
import { validContactUrl, type Contact, type MenuGroup } from '@/lib/line/richmenu';
import type { Employee, Tag, Member } from '@/lib/line/tags';
type Data = { contacts: Contact[]; menus: { group_key: MenuGroup; richmenu_id: string; created_at: string; applied_at:string|null }[]; employees: Employee[]; tags: Tag[]; members: Member[] };
export default function ContactSettings({ data, busy, act }: { data: Data; busy: boolean; act: (payload: object) => Promise<unknown> }) {
  const [edit, setEdit] = useState<Contact>();
  const [error, setError] = useState('');
  return <>
    <DataTable defaultSort={{id:'name',direction:'asc'}} rows={data.contacts} rowKey={c=>c.key} searchText={c=>c.label} columns={[
      { id:'name',label:'連絡先',type:'text',value:c=>c.label },
      { id:'url',label:'リンク',type:'text',value:c=>c.url||'未登録' },
    ]} onRowClick={c=>{setEdit({...c});setError('');}}/>
    {edit&&<Modal title={edit.label+'の連絡先'} onClose={()=>setEdit(undefined)} actions={<SubmitButton busy={busy} onClick={async()=>{
      if(!validContactUrl(edit.key,edit.url.trim())) { setError(edit.key==='guest_home'?'https で始まるリンクを入力してください。':'LINE のリンクを入力してください'); return; }
      if(await act({action:'contact',key:edit.key,url:edit.url}))setEdit(undefined);
      else setError('登録できませんでした。入力したリンクを確認してください。');
    }}>登録する</SubmitButton>}>
      <FormRow label="リンク"><TextField aria-label="連絡先のリンク" type="url" maxLength={2000} value={edit.url} onChange={e=>setEdit({...edit,url:e.target.value})}/></FormRow>
      <p>登録したら、リッチメニュータブの［リッチメニューに反映する］を押してください。</p>
      <ResultMessage>{error}</ResultMessage>
    </Modal>}
  </>;
}
