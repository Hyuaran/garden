import { expect, it } from 'vitest';
// Pure planning module: importing it never opens a DB or Kintone connection.
import { normalizeTeam, planImport } from '../../../../scripts/import-team-history.mjs';
const field=(value:unknown)=>({value});
const employee={employee_id:'E1',employee_number:'0001',name:'テスト社員',kot_employee_id:'0001',employment_type:'アルバイト',business:null};
const record={'$id':field('10'),'打刻ID':field('1'),'雇用形態':field('アルバイト'),'テーブル':field([{id:'100',value:{'日付_8':field('2026-10-01'),'日時':field('2026-10-01T00:00:00Z'),'ドロップダウン_17':field('ヒュアラングループ')}}])};
it('ヒュアランはアルバイトだけ新人、それ以外は所属なし',()=>{
  expect(normalizeTeam('ヒュアラングループ','アルバイト')).toBe('新人チーム');
  expect(normalizeTeam('ヒュアラングループ','正社員')).toBe('所属なし');
});
it('打刻IDで突合し、LINEの確認値を補正行にし、再実行で重複しない',()=>{
  const tags=[{id:'b',kind:'business',name:'ブロードバンド事業'},{id:'t',kind:'team',name:'小泉チーム'}];
  const members=tags.map(t=>({employee_id:'E1',tag_id:t.id,source:'manual'}));
  const plan=planImport([record],[employee],[],tags,members);
  expect(plan.inserts).toHaveLength(2);
  expect(plan.inserts[0]).toMatchObject({team:'新人チーム',source:'kintone',entered_by:'kintone'});
  expect(plan.inserts[1]).toMatchObject({team:'小泉チーム',source:'garden',effective_date:'2026-10-29'});
  expect(plan.updates).toEqual([{employee_id:'E1',business:'ブロードバンド事業'}]);
  expect(plan.corrected).toHaveLength(1);
  const again=planImport([record],[{...employee,business:'ブロードバンド事業'}],plan.inserts,tags,members);
  expect(again.inserts).toEqual([]);expect(again.updates).toEqual([]);
});
