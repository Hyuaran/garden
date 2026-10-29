import { expect, it } from 'vitest';
import { currentTeam, validTeamInput } from './team-history';
it('未来の所属は移動日から効き、同日は入力日時・IDの新しい順',()=>{
  const rows=[{id:'1',effective_date:'2026-10-01',entered_at:'2026-10-01T00:00:00Z',team:'宮永チーム'},{id:'2',effective_date:'2026-11-01',entered_at:'2026-10-29T00:00:00Z',team:'小泉チーム'}];
  expect(currentTeam(rows,'2026-10-29')).toBe('宮永チーム');
  expect(currentTeam(rows,'2026-11-01')).toBe('小泉チーム');
  expect(currentTeam(rows,'2026-09-01')).toBeNull();
  expect(currentTeam([...rows,{...rows[1],id:'3',team:'新人チーム'}],'2026-11-01')).toBe('新人チーム');
});
it('日付・所属・メモを検証する',()=>{
  expect(validTeamInput({effective_date:'2026-10-29',team:'所属なし'})).toBe(true);
  for(const row of [{effective_date:'2026-02-30',team:'新人チーム'},{effective_date:'2026-10-29',team:'不明'},{effective_date:'2026-10-29',team:'所属なし',memo:123}])expect(validTeamInput(row)).toBe(false);
});
