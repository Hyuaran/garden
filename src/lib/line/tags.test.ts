import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { automaticTags, chooseGreeting, chunks, linkMessages, matchesTags, personalize, recipients, statusOf, type Employee, type Tag, type Greeting } from './tags';
const tags:Tag[]=[{id:'e',kind:'employment',name:'正社員',sort:1},{id:'b',kind:'business',name:'ブロードバンド事業',sort:1},{id:'b2',kind:'business',name:'NHK派遣事業',sort:2},{id:'s',kind:'status',name:'在籍中',sort:1},{id:'r',kind:'role',name:'トス',sort:1},{id:'f',kind:'free',name:'研修中',sort:1}];
const employee:Employee={employee_id:'1',employee_number:'0001',name:'山田 太郎',employment_type:'正社員',garden_role:'toss',hire_date:'2020-01-01',termination_date:null,is_active:true,line_user_id:'U1',line_link_source:'self'};
const common:Greeting={id:'common',employment_tag_id:null,business_tag_id:null,body:'{名前}さん',enabled:true};
describe('公式LINEのタグと文',()=>{
 it('雇用形態×事業、雇用形態、共通の順で選ぶ',()=>{
  const employment={...common,id:'employment',employment_tag_id:'e'};
  const business={...employment,id:'business',business_tag_id:'b'};
  expect(chooseGreeting([common,employment,business],['e','b'])?.id).toBe('business');
  expect(chooseGreeting([common,employment,business],['e'])?.id).toBe('employment');
  expect(chooseGreeting([common,employment,business],[])?.id).toBe('common');
  expect(chooseGreeting([common,{...business,enabled:false}],['e','b'])?.id).toBe('common');
  expect(personalize('{名前}さん、{名前}さん',employee.name)).toBe('山田さん、山田さん');
 });
 it('名簿から雇用形態・在籍・役割を作る',()=>{
  expect(automaticTags(employee,tags).map(m=>m.tag_id)).toEqual(['e','s','r']);
  expect(statusOf({...employee,hire_date:'2099-01-01'})).toBe('入社予定');
  expect(statusOf({...employee,is_active:false})).toBe('退職');
  expect(statusOf({...employee,termination_date:'2020-01-01'})).toBe('退職');
  expect(automaticTags({...employee,employment_type:'outsource'},tags).some(m=>m.tag_id==='r')).toBe(false);
 });
 it('同じ種類はまたは、種類間はかつ、未連携と退職は除外する',()=>{
  const members=[...automaticTags(employee,tags),{employee_id:'1',tag_id:'b',source:'manual' as const}];
  expect(matchesTags('1',['b','b2','e'],tags,members)).toBe(true);
  expect(matchesTags('1',['b2','e'],tags,members)).toBe(false);
  expect(matchesTags('1',['b','f'],tags,members)).toBe(false);
  expect(recipients([employee,{...employee,employee_id:'2',line_user_id:null},{...employee,employee_id:'3',is_active:false},{...employee,employee_id:'4',line_link_source:'unfollowed'}],[],tags,members)).toEqual([employee]);
 });
 it('500人ずつ分け、連携成功とあいさつを2吹き出しにする',()=>{
  expect(chunks(Array.from({length:1001},(_,i)=>i)).map(x=>x.length)).toEqual([500,500,1]);
  expect(linkMessages('山田','こんにちは')).toEqual(['山田さんとして登録しました。ありがとうございます。','こんにちは']);
 });
 it('自動の行だけをトランザクション内で入れ替える',()=>{
  const sql=readFileSync('supabase/migrations/20261029000471_system_line_tags.sql','utf8');
  expect(sql).toContain("delete from system_line_tag_member where source='auto'");
  expect(sql).toContain('on conflict(tag_id,employee_id) do nothing');
  expect(sql).toContain('pg_advisory_xact_lock');
 });
});
