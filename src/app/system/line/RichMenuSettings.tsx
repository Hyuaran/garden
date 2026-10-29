'use client';
import { useState } from 'react';
import DataTable from '../_components/DataTable/DataTable';
import Modal from '../_components/Modal/Modal';
import { FormRow, SubmitButton, SelectField, ResultMessage } from '../forms/_components/form-kit';
import { menuGroups, groupLabels, menuGroup, menuDefinition, roleLabels, contactRows, type Contact, type MenuGroup } from '@/lib/line/richmenu';
import type { Employee, Tag, Member } from '@/lib/line/tags';

type Data = { contacts: Contact[]; menus: { group_key: MenuGroup; applied_at: string|null }[]; employees: Employee[]; tags: Tag[]; members: Member[] };
export default function RichMenuSettings({data,busy,act}:{data:Data;busy:boolean;act:(payload:object)=>Promise<unknown>}) {
  const [group,setGroup]=useState<MenuGroup>();
  const [role,setRole]=useState<Contact>();
  const [saved,setSaved]=useState(false);
  const people=(key:MenuGroup)=>data.employees.filter(e=>menuGroup(e,data.tags,data.members)===key);
  const definition=group?menuDefinition(group,data.contacts,process.env.NEXT_PUBLIC_LIFF_SHIFT_ID):undefined;
  const areas=definition?.body.areas.map((area,index)=>{
    const {bounds,action}=area;
    const position=definition.body.areas.length===1?'全体':definition.body.size.height>843?(bounds.x===0?'左':'右')+(bounds.y===0?'上':'下'):bounds.x===0?'左':bounds.x+bounds.width===2500?'右':'中央';
    const label=group==='guest'?(index===0?'お問い合わせ':'会社のホームページ'):index===0?'申告フォーム':index===1?'シフト':index===3?'マネージャー':definition.body.size.height>843?'チームリーダー':'担当者';
    let description:string;
    if(group==='guest'&&index===1&&action.type==='message') description='準備中です（会社のホームページが登録されていません）';
    else if(action.type==='message') description=`「${action.text}」と送られ、案内が返ります`;
    else if(action.uri.startsWith('https://liff.line.me/')) description=index===0?'LINE の中で申告フォームのページが開きます（通勤経路の変更・給与受取口座の変更）':'LINE の中でシフト確認のページが開きます';
    else if(group==='guest') description=`会社のホームページ（${action.uri}）が開きます`;
    else {
      const owner=data.contacts.find(c=>c.url===action.uri);
      const fallback=index===2&&(group==='koizumi'||group==='ishihara'||group==='nhk'||group==='kanden'||group==='office')&&!data.contacts.find(c=>c.key===(group==='koizumi'?'team:小泉チーム':group==='ishihara'?'team:石原チーム':group))?.url;
      description=`${fallback?'（登録がないため）':''}${owner?.label||'マネージャー'}の LINE（${action.uri}）が開きます`;
    }
    return {id:String(index),position,label,description};
  })||[];
  return <>
    <h2>メニューの担当</h2>
    <DataTable rows={data.contacts.filter(c=>Object.hasOwn(roleLabels,c.key))} rowKey={c=>c.key} searchText={c=>roleLabels[c.key]+c.label} defaultSort={{id:'role',direction:'asc'}} onRowClick={c=>setRole({...c})} columns={[
      {id:'role',label:'役割',type:'text',value:c=>roleLabels[c.key]},
      {id:'owner',label:'担当',type:'text',value:c=>c.label||'マネージャーが担当'},
    ]}/>
    {saved&&<ResultMessage success>登録したら［リッチメニューに反映する］を押してください。</ResultMessage>}
    <div style={{display:'flex',justifyContent:'flex-end'}}><SubmitButton style={{width:'auto'}} busy={busy} onClick={()=>act({action:'applyMenus'})}>リッチメニューに反映する</SubmitButton></div>
    <DataTable rows={[...menuGroups]} rowKey={g=>g} searchText={g=>groupLabels[g]} defaultSort={{id:'group',direction:'asc'}} onRowClick={setGroup} columns={[
      {id:'group',label:'組み合わせ',type:'text',value:g=>groupLabels[g]},
      {id:'count',label:'人数',type:'number',value:g=>g==='guest'?-1:people(g).length,render:g=>g==='guest'?'—':String(people(g).length)},
      {id:'date',label:'最後に反映した日時',type:'text',align:'fixed',value:g=>{const date=data.menus.find(m=>m.group_key===g)?.applied_at;return date?new Date(date).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'反映していません';}},
    ]}/>
    {group&&definition&&<Modal title={groupLabels[group]+' のメニュー'} onClose={()=>setGroup(undefined)}>
      {/* Static public menu artwork must keep its original aspect ratio. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={'/api/system/line/richmenu-image?group='+group} alt={groupLabels[group]+'のメニュー'} style={{width:'100%',height:'auto'}}/>
      {areas.map(r=><FormRow key={r.id} label={`${r.position}　${r.label}`}><p>{r.description}</p></FormRow>)}
      <p>{group==='guest'?'Garden に紐づいていない友だち全員に出ます（従業員以外の方・紐づけ前の従業員・退職した人）。':`このメニューの人（${people(group).length} 人）：${people(group).map(e=>e.name).join('・')||'いません'}`}</p>
    </Modal>}
    {role&&<Modal title={roleLabels[role.key]} onClose={()=>setRole(undefined)} actions={<SubmitButton busy={busy} onClick={async()=>{if(await act({action:'assignment',key:role.key,employeeId:role.employee_id||null})){setRole(undefined);setSaved(true);}}}>登録する</SubmitButton>}>
      <FormRow label="担当"><SelectField aria-label="担当" value={role.employee_id||''} onChange={e=>setRole({...role,employee_id:e.target.value||null})}><option value="">マネージャーが担当</option>{contactRows(data.employees,data.contacts).filter(c=>c.employee_id).map(c=><option key={c.key} value={c.employee_id!}>{c.label}</option>)}</SelectField></FormRow>
    </Modal>}
  </>;
}
