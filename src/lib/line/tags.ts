export type Tag = { id: string; kind: 'employment' | 'business' | 'status' | 'role' | 'team' | 'free'; name: string; sort: number };
export type Member = { tag_id: string; employee_id: string; source: 'auto' | 'manual' };
export type Employee = { line_contact_url?: string | null; employee_id: string; employee_number: string; name: string; employment_type: string; garden_role: string; hire_date: string | null; termination_date: string | null; is_active: boolean; line_user_id: string | null; line_link_source: string | null };
export type Greeting = { id: string; employment_tag_id: string | null; business_tag_id: string | null; body: string; enabled: boolean };
export const kindLabels = { employment: '雇用形態', business: '事業', status: '在籍', role: '役割', team: 'チーム', free: '自由タグ' };
export function statusOf(e: Employee, today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })) {
  if (!e.is_active || (e.termination_date && e.termination_date <= today)) return '退職';
  return e.hire_date && e.hire_date > today ? '入社予定' : '在籍中';
}
export function automaticTags(e: Employee, tags: Tag[], today?: string): Member[] {
  const employment = ['outsource', '業務委託'].includes(e.employment_type) ? '業務委託' : e.employment_type;
  const roles: Record<string, string> = { toss: 'トス', closer: 'クローザー', cs: 'CS' };
  const role = employment === '業務委託' ? null : roles[e.garden_role] ?? '事務';
  return tags.filter(t => (t.kind === 'employment' && t.name === employment) || (t.kind === 'status' && t.name === statusOf(e, today)) || (t.kind === 'role' && t.name === role)).map(t => ({ tag_id: t.id, employee_id: e.employee_id, source: 'auto' }));
}
export function automaticTeamTag(e: Employee, tags: Tag[], members: Member[]): Member[] {
  const own = tags.filter(t => members.some(m => m.employee_id === e.employee_id && m.tag_id === t.id));
  if (e.employment_type !== 'アルバイト' || !own.some(t => t.kind === 'business' && t.name === 'ブロードバンド事業') || own.some(t => t.kind === 'team')) return [];
  const team = tags.find(t => t.kind === 'team' && t.name === '新人チーム');
  return team ? [{tag_id:team.id,employee_id:e.employee_id,source:'auto'}] : [];
}
export function matchesTags(id: string, selected: string[], tags: Tag[], members: Member[]) {
  const own = new Set(members.filter(m => m.employee_id === id).map(m => m.tag_id));
  return Object.keys(kindLabels).every(kind => { const group = tags.filter(t => t.kind === kind && selected.includes(t.id)); return !group.length || group.some(t => own.has(t.id)); }) && selected.every(id => tags.some(t => t.id === id));
}
export function recipients(employees: Employee[], selected: string[], tags: Tag[], members: Member[]) {
  return employees.filter(e => e.line_user_id && e.line_link_source !== 'unfollowed' && statusOf(e) !== '退職' && matchesTags(e.employee_id, selected, tags, members));
}
export function chooseGreeting(greetings: Greeting[], own: string[]) {
  const score = (g: Greeting) => Number(Boolean(g.employment_tag_id)) * 2 + Number(Boolean(g.business_tag_id));
  return greetings.filter(g => g.enabled && (!g.employment_tag_id || own.includes(g.employment_tag_id)) && (!g.business_tag_id || own.includes(g.business_tag_id))).sort((a,b) => score(b)-score(a) || a.id.localeCompare(b.id))[0];
}
export function personalize(body: string, name: string) { return body.replaceAll('{名前}', name.trim().split(/[\s　]+/)[0] || ''); }
export function linkMessages(name: string, greeting?: string) { return [`${name}さんとして登録しました。ありがとうございます。`, ...(greeting ? [greeting.slice(0,5000)] : [])].slice(0,5); }
export function chunks<T>(values: T[], size = 500): T[][] { return Array.from({length: Math.ceil(values.length / size)}, (_, i) => values.slice(i*size,(i+1)*size)); }
