// @vitest-environment node
import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { contactRows, resolveContacts, menuDefinition, menuImageLabels, menuGroups, type Contact } from './richmenu';
import type { Employee } from './tags';
import { renderMenuImage } from './richmenu-image.server';
const employee: Employee={employee_id:'1',employee_number:'1165',name:' 宮永　 ひかり ',employment_type:'アルバイト',garden_role:'toss',hire_date:null,termination_date:null,is_active:true,line_user_id:null,line_link_source:null,line_contact_url:'https://line.me/ti/p/manager'};
const role=(key:string,id:string|null):Contact=>({key,employee_id:id,label:'役割',url:'',updated_at:'',updated_by:null});
const roles=[role('miyanaga','1'),role('team:小泉チーム','2'),role('team:石原チーム',null),role('nhk','3'),role('office','2'),{...role('guest_home',null),label:'会社のホームページ'}];
const people=[employee,{...employee,employee_id:'2',name:'小泉 翔',line_contact_url:'https://line.me/ti/p/leader'},{...employee,employee_id:'3',name:'桐井 大輔',line_contact_url:'https://line.me/ti/p/nhk'}];
it('一覧は在籍者の名簿の連絡先とホームページ。役割とは別に追加・変更・削除される',()=>{
 expect(contactRows([...people,{...employee,employee_id:'4',is_active:false},{...employee,employee_id:'5',line_contact_url:''}],roles).map(c=>c.label)).toEqual(['宮永 ひかり','小泉 翔','桐井 大輔','会社のホームページ']);
 expect(contactRows([{...employee,line_contact_url:'https://line.me/changed'}],roles)[0].url).toBe('https://line.me/changed');
 expect(contactRows([{...employee,line_contact_url:''}],roles)).toHaveLength(1);
});
it('担当を変えると名簿のリンクを開き、空の役割はマネージャーへ開く',()=>{
 const contacts=resolveContacts(roles,people);
 expect(menuDefinition('koizumi',contacts).body.areas[2].action).toEqual({type:'uri',uri:people[1].line_contact_url});
 expect(menuDefinition('ishihara',contacts).body.areas[2].action).toEqual({type:'uri',uri:employee.line_contact_url});
 const reassigned=resolveContacts(roles.map(r=>r.key==='office'?{...r,employee_id:'3'}:r),people);
 expect(menuDefinition('office',reassigned).body.areas[2].action).toEqual({type:'uri',uri:people[2].line_contact_url});
});
it('各グループの画像に姓と指定位置を使う',()=>{
 const c=resolveContacts(roles,people);
 expect(menuImageLabels('guest',c)).toEqual([]);
 expect(menuImageLabels('koizumi',c)).toEqual([{text:'小泉さんに連絡',x:625,y:1483,size:58},{text:'宮永さんに連絡',x:1875,y:1483,size:58}]);
 expect(menuImageLabels('ishihara',c)[0].text).toBe('宮永さんに連絡');
 expect(menuImageLabels('nhk',c)).toEqual([{text:'桐井さんに連絡',x:2083,y:640,size:46}]);
 expect(menuImageLabels('office',c)[0].text).toBe('小泉さんに連絡');
 expect(menuImageLabels('telema',c)[0].text).toBe('宮永さんに連絡');
});
it('移行は5人のリンクと担当を登録し、名簿の取得にも同じ項目を含む',async()=>{
 const sql=await readFile('supabase/migrations/20261029000476_line_contact_roster.sql','utf8');
 for(const value of ['1165','1326','1523','1508','0008','-xQCaOeokf','gkj0hZCq83','9x7lHB1Uy0','k8yMfVVJWG','KRNGw6Bi-N']) expect(sql).toContain(value);
 expect(sql).toContain('guard_line_contact_removal');
 expect(await readFile('src/app/root/_lib/employee-select.ts','utf8')).toContain('"line_contact_url"');
});
it('実際の画像生成が6グループとも1MB以内に収まる',async()=>{
 const sharp=(await import('next/node_modules/sharp')).default;
 for(const group of menuGroups){
  const image=await renderMenuImage(group,resolveContacts(roles,people));
  expect(image.data.length).toBeLessThanOrEqual(1000000);
  const meta=await sharp(image.data).metadata();
  expect(meta.width).toBe(2500);expect(meta.height).toBe(group==='koizumi'||group==='ishihara'?1686:843);
 }
},60000);
