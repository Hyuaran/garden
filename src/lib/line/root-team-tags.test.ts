import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { automaticTags, type Employee, type Tag } from './tags';
import { menuGroup } from './richmenu';
const tags:Tag[]=[...['ブロードバンド事業','NHK派遣事業','関西電力事業'].map((name,i)=>({id:`b${i}`,kind:'business' as const,name,sort:i})),...['宮永チーム','小泉チーム','石原チーム','新人チーム'].map((name,i)=>({id:`t${i}`,kind:'team' as const,name,sort:i}))];
const base:Employee={employee_id:'E1',employee_number:'1',name:'テスト',employment_type:'アルバイト',garden_role:'toss',hire_date:'2020-01-01',termination_date:null,is_active:true,line_user_id:'U1',line_link_source:'self'};
it('Rootの事業と所属からautoを作り、対象外の所属にはチームタグを付けない',()=>{
  expect(automaticTags({...base,business:'ブロードバンド事業',current_team:'小泉チーム'},tags).map(m=>[m.tag_id,m.source])).toEqual([['b0','auto'],['t1','auto']]);
  for(const team of ['バックヤード','所属なし',null])expect(automaticTags({...base,business:'ブロードバンド事業',current_team:team},tags)).toHaveLength(1);
  expect(automaticTags({...base,business:'NHK派遣事業',current_team:'小泉チーム'},tags).map(m=>m.tag_id)).toEqual(['b1']);
});
it('30人の模擬データで手動タグとメニューの振り分けが一致する',()=>{
  for(let i=0;i<30;i++) {
    const business=tags[i%3].name, team=tags[3+i%4].name;
    const e={...base,employee_id:String(i),business,current_team:team,employment_type:i%2?'アルバイト':'正社員'};
    const manual=tags.filter(t=>t.kind==='business'&&t.name===business||t.kind==='team'&&business==='ブロードバンド事業'&&t.name===team).map(t=>({tag_id:t.id,employee_id:e.employee_id,source:'manual' as const}));
    expect(menuGroup(e,tags,automaticTags(e,tags))).toBe(menuGroup(e,tags,manual));
  }
});
it('LINEの小窓は事業・チームを表示し、Rootの詳細へリンクする',()=>{
  const ui=readFileSync('src/app/system/line/LineManager.tsx','utf8');
  expect(ui).toContain('<FormRow label="事業"><FixedValue>');
  expect(ui).toContain('<FormRow label="チーム"><FixedValue>');
  expect(ui).toContain('/root/employees?employeeId=');
  expect(ui).toContain('Root の社員情報で変更します');
});
