import { statusOf, type Employee, type Member, type Tag } from './tags';

export type Contact = { key: string; employee_id?: string | null; label: string; url: string; updated_at: string; updated_by: string | null };
export const menuGroups = ['guest', 'telema', 'koizumi', 'ishihara', 'nhk', 'office'] as const;
export type MenuGroup = typeof menuGroups[number];
export const groupLabels: Record<MenuGroup, string> = { guest: '従業員以外の方', telema: 'ブロードバンド事業・宮永チーム・新人チーム・チームなしのアルバイト', koizumi: 'ブロードバンド事業・小泉チーム', ishihara: 'ブロードバンド事業・石原チーム', nhk: 'NHK派遣事業', office: '事務・その他の従業員' };
export function menuGroup(e: Employee, tags: Tag[], members: Member[]): MenuGroup {
  if (!e.line_user_id || e.line_link_source === 'unfollowed' || statusOf(e) === '退職') return 'guest';
  const own = tags.filter(t => members.some(m => m.employee_id === e.employee_id && m.tag_id === t.id));
  if (own.some(t => t.kind === 'business' && t.name === 'ブロードバンド事業')) {
    if (own.some(t => t.kind === 'team' && t.name === '小泉チーム')) return 'koizumi';
    if (own.some(t => t.kind === 'team' && t.name === '石原チーム')) return 'ishihara';
    if (!own.some(t => t.kind === 'team') && e.employment_type !== 'アルバイト') return 'office';
    return 'telema';
  }
  if (own.some(t => t.kind === 'business' && t.name === 'NHK派遣事業')) return 'nhk';
  return 'office';
}
export function validContactUrl(key: string, url: string) {
  if (!url) return true;
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && (key === 'guest_home' || (url.startsWith('https://line.me/') && u.hostname === 'line.me')); } catch { return false; }
}
type Action = { type: 'message'; text: string } | { type: 'uri'; uri: string };
export function menuDefinition(group: MenuGroup, contacts: Contact[], liffId?: string, formsId = process.env.NEXT_PUBLIC_LIFF_FORMS_ID) {
  const message = (text: string): Action => ({ type: 'message', text });
  const contact = (key: string): Action => {
    const url = contacts.find(c => c.key === key)?.url || (key !== 'guest_home' ? contacts.find(c => c.key === 'miyanaga')?.url : '');
    return url && validContactUrl(key, url) ? { type: 'uri', uri: url } : message('準備中');
  };
  const four = group === 'koizumi' || group === 'ishihara';
  const guest = group === 'guest';
  const image = guest ? 'guest_2' : four ? 'employee_4_base' : 'employee_3_base';
  const actions: Action[] = guest ? [message('お問い合わせ'), contact('guest_home')] : [
    formsId ? { type: 'uri', uri: 'https://liff.line.me/' + formsId } : message('申告フォーム'), liffId ? { type: 'uri', uri: 'https://liff.line.me/' + liffId } : message('シフト'),
    contact(group === 'koizumi' ? 'team:小泉チーム' : group === 'ishihara' ? 'team:石原チーム' : group === 'nhk' ? 'nhk' : group === 'office' ? 'office' : 'miyanaga'),
    ...(four ? [contact('miyanaga')] : []),
  ];
  const columns = four ? 2 : actions.length;
  const xs = Array.from({ length: columns + 1 }, (_, i) => Math.round(i * 2500 / columns));
  return { image, body: { size: { width: 2500, height: four ? 1686 : 843 }, selected: true, name: 'Garden ' + group, chatBarText: 'メニュー', areas: actions.map((action, i) => ({ bounds: { x: xs[i % columns], y: Math.floor(i / columns) * 843, width: xs[i % columns + 1] - xs[i % columns], height: 843 }, action })) } };
}

export const roleLabels: Record<string, string> = {
  miyanaga: 'マネージャー', 'team:小泉チーム': '小泉チームのリーダー', 'team:石原チーム': '石原チームのリーダー', nhk: 'NHK派遣事業の担当', office: '事務・その他の担当',
};
export const contactName = (name: string) => name.trim().replace(/[\s　]+/g, ' ');
export function resolveContacts(roles: Contact[], employees: Employee[]): Contact[] {
  return roles.map(role => {
    if (role.key === 'guest_home') return role;
    const person = employees.find(e => e.employee_id === role.employee_id && statusOf(e) === '在籍中');
    return {...role, label: person ? contactName(person.name) : '', url: person?.line_contact_url || ''};
  });
}
export function contactRows(employees: Employee[], roles: Contact[]): Contact[] {
  return [...employees.filter(e => statusOf(e) === '在籍中' && e.line_contact_url).map(e => ({key: e.employee_id, employee_id: e.employee_id, label: contactName(e.name), url: e.line_contact_url!, updated_at: '', updated_by: null})), ...roles.filter(c => c.key === 'guest_home')];
}
export function menuImageLabels(group: MenuGroup, contacts: Contact[]) {
  if (group === 'guest') return [];
  const surname = (key: string) => contactName((contacts.find(c => c.key === key && c.url) || contacts.find(c => c.key === 'miyanaga'))?.label || '').split(' ')[0];
  const label = (key: string, x: number, y: number, size: number) => ({text: surname(key) ? surname(key) + 'さんに連絡' : '準備中', x, y, size});
  if (group === 'koizumi' || group === 'ishihara') return [label(group === 'koizumi' ? 'team:小泉チーム' : 'team:石原チーム',625,1483,58),label('miyanaga',1875,1483,58)];
  return [label(group === 'nhk' || group === 'office' ? group : 'miyanaga',2083,640,46)];
}
