export const TEAMS = ['宮永チーム', '小泉チーム', '石原チーム', '新人チーム', 'バックヤード', '所属なし'] as const;
export const BUSINESSES = ['ブロードバンド事業', 'NHK派遣事業', '関西電力事業'] as const;
export type TeamHistory = { id: string; employee_id: string; effective_date: string; team: string; memo: string | null; entered_by: string; entered_at: string; source: 'garden' | 'kintone' };
export function currentTeam(rows: Pick<TeamHistory, 'effective_date' | 'entered_at' | 'id' | 'team'>[], onDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })) {
  return rows.filter(r => r.effective_date <= onDate).sort((a,b) => b.effective_date.localeCompare(a.effective_date) || b.entered_at.localeCompare(a.entered_at) || b.id.localeCompare(a.id))[0]?.team ?? null;
}
export function validTeamInput(body: Record<string, unknown>) {
  const date = body.effective_date;
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date
    && TEAMS.includes(body.team as typeof TEAMS[number]) && (body.memo == null || typeof body.memo === 'string' && body.memo.length <= 5000);
}
