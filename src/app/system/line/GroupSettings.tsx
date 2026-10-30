'use client';
import { useCallback, useEffect, useState } from 'react';
import DataTable from '../_components/DataTable/DataTable';
import Modal from '../_components/Modal/Modal';
import { ActionButton, ActionRow, FormRow, RadioGroup, ResultMessage, SubmitButton, TextField } from '../forms/_components/form-kit';
import type { LineGroup } from '@/lib/line/groups';
type Draft = {id?:string;label:string;room:string;notify:boolean};
export default function GroupSettings() {
  const [groups,setGroups]=useState<LineGroup[]>([]);
  const [draft,setDraft]=useState<Draft>();
  const [code,setCode]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const load=useCallback(async()=>{
    const r=await fetch('/api/system/line/groups',{cache:'no-store'});
    if(!r.ok) throw new Error('グループを読み込めませんでした。');
    setGroups((await r.json()).groups);
  },[]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  function open(value:Draft) {setDraft(value);setCode('');setError('');setConfirm(false);}
  async function act(action:'save'|'code'|'remove') {
    if(busy || !draft) return;
    setBusy(true);setError('');
    try {
      const r=await fetch('/api/system/line/groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...draft,action,confirm})});
      const result=await r.json();
      if(!r.ok) throw new Error(result.error || '保存できませんでした。');
      await load();
      if(result.code) {setCode(result.code);setDraft({...draft,id:result.id});}
      else {setDraft(undefined);setConfirm(false);}
    } catch(e) {setError(e instanceof Error?e.message:'保存できませんでした。');}
    finally {setBusy(false);}
  }
  return <>
    <ActionRow><ActionButton onClick={()=>open({label:'',room:'',notify:false})}>グループを追加する</ActionButton></ActionRow>
    {error&&!draft&&<ResultMessage>{error}</ResultMessage>}
    <DataTable rows={groups} rowKey={g=>g.id} searchPlaceholder="グループ名・ルームID" searchText={g=>`${g.label||''} ${g.chatwork_room_id||''}`} defaultSort={{id:'label',direction:'asc'}} onRowClick={g=>open({id:g.id,label:g.label||'',room:g.chatwork_room_id||'',notify:g.notify_enabled})} columns={[
      {id:'label',label:'グループの名前',type:'text',value:g=>g.label||'（名前なし）'},
      {id:'account',label:'アカウント',type:'text',value:g=>g.account==='dev'?'開発用':'従業員向け'},
      {id:'room',label:'知らせ先のルーム',type:'text',align:'fixed',value:g=>g.chatwork_room_id||'—'},
      {id:'notify',label:'知らせ',type:'text',align:'mark',value:g=>g.notify_enabled?'オン':'オフ'},
      {id:'linked',label:'結んだ日時',type:'text',align:'fixed',value:g=>g.linked_at?new Date(g.linked_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'—'},
    ]}/>
    {draft&&<Modal title={draft.id?'グループの変更':'グループを追加する'} onClose={()=>{if(!busy)setDraft(undefined);}} actions={<>
      {draft.id&&<ActionButton disabled={busy} onClick={()=>act('save')}>保存する</ActionButton>}
      <SubmitButton busy={busy} onClick={()=>act('code')}>確認コードを作る</SubmitButton>
    </>}>
      <FormRow label="1 グループの名前"><TextField aria-label="グループの名前" maxLength={100} value={draft.label} onChange={e=>{setDraft({...draft,label:e.target.value});setCode('');}}/></FormRow>
      <FormRow label="2 知らせ先の Chatwork ルームの番号"><TextField aria-label="知らせ先の Chatwork ルームの番号" inputMode="numeric" maxLength={40} value={draft.room} onChange={e=>{setDraft({...draft,room:e.target.value});setCode('');}}/></FormRow>
      {draft.id&&<FormRow label="3 知らせ"><RadioGroup name="group-notify" label="知らせ" options={['オン','オフ']} value={draft.notify?'オン':'オフ'} onChange={value=>setDraft({...draft,notify:value==='オン'})}/></FormRow>}
      {code&&<p role="status">LINE のグループに次の文を書き込んでください：連携 {code}（24 時間有効）</p>}
      {error&&<ResultMessage>{error}</ResultMessage>}
      {draft.id&&<ActionButton style={{color:'var(--danger, #b42318)',borderColor:'var(--danger, #b42318)'}} disabled={busy} onClick={()=>setConfirm(true)}>このグループの記録を外す</ActionButton>}
    </Modal>}
    {confirm&&<Modal title="グループの記録を外しますか" onClose={()=>{if(!busy)setConfirm(false);}} actions={<><ActionButton disabled={busy} onClick={()=>setConfirm(false)}>戻る</ActionButton><ActionButton style={{color:'var(--danger, #b42318)',borderColor:'var(--danger, #b42318)'}} disabled={busy} onClick={()=>act('remove')}>記録を外す</ActionButton></>}><p>このグループからの知らせを止め、一覧から外します。</p>{error&&<ResultMessage>{error}</ResultMessage>}</Modal>}
  </>;
}
