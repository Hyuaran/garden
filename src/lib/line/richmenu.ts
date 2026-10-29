import { statusOf, type Employee, type Member, type Tag } from './tags';

export type Contact = { key: string; label: string; url: string; updated_at: string; updated_by: string | null };
export const menuGroups = ['guest', 'telema', 'koizumi', 'ishihara', 'nhk', 'office'] as const;
export type MenuGroup = typeof menuGroups[number];
export const groupLabels: Record<MenuGroup, string> = { guest: '従業員以外の方', telema: 'ブロードバンド事業・宮永チーム・新人チーム・チームなし', koizumi: 'ブロードバンド事業・小泉チーム', ishihara: 'ブロードバンド事業・石原チーム', nhk: 'NHK派遣事業', office: '事務・その他の従業員' };
export function menuGroup(e: Employee, tags: Tag[], members: Member[]): MenuGroup {
  if (!e.line_user_id || e.line_link_source === 'unfollowed' || statusOf(e) === '退職') return 'guest';
  const own = tags.filter(t => members.some(m => m.employee_id === e.employee_id && m.tag_id === t.id));
  if (own.some(t => t.kind === 'business' && t.name === 'ブロードバンド事業')) {
    if (own.some(t => t.kind === 'team' && t.name === '小泉チーム')) return 'koizumi';
    if (own.some(t => t.kind === 'team' && t.name === '石原チーム')) return 'ishihara';
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
export function menuDefinition(group: MenuGroup, contacts: Contact[], liffId?: string) {
  const message = (text: string): Action => ({ type: 'message', text });
  const contact = (key: string): Action => {
    const url = contacts.find(c => c.key === key)?.url || (key !== 'guest_home' ? contacts.find(c => c.key === 'miyanaga')?.url : '');
    return url && validContactUrl(key, url) ? { type: 'uri', uri: url } : message('準備中');
  };
  const four = group === 'koizumi' || group === 'ishihara';
  const guest = group === 'guest';
  const image = guest ? 'guest_2' : four ? 'employee_4' : 'employee_3';
  const actions: Action[] = guest ? [message('お問い合わせ'), contact('guest_home')] : [
    message('申告フォーム'), liffId ? { type: 'uri', uri: 'https://liff.line.me/' + liffId } : message('シフト'),
    contact(group === 'koizumi' ? 'team:小泉チーム' : group === 'ishihara' ? 'team:石原チーム' : group === 'nhk' ? 'nhk' : group === 'office' ? 'office' : 'miyanaga'),
    ...(four ? [contact('miyanaga')] : []),
  ];
  return { image, body: { size: { width: 2500, height: guest ? 843 : 1686 }, selected: true, name: 'Garden ' + group, chatBarText: 'メニュー', areas: actions.map((action, i) => ({ bounds: { x: i < 2 || four ? (i % 2) * 1250 : 0, y: i < 2 ? 0 : 843, width: i >= 2 && !four ? 2500 : 1250, height: 843 }, action })) } };
}
