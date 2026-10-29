export type LineGroup = {
  id: string; label: string | null; account: 'dev' | 'official';
  chatwork_room_id: string | null; notify_enabled: boolean; linked_at: string | null;
};
export function parseGroupCode(text: string) {
  const normalized = text.normalize('NFKC').replace(/\s/g, '');
  return /^連携G-\d{4}$/i.test(normalized) ? normalized.slice(2).toUpperCase() : null;
}
export function groupMessage(message: { type?: string; text?: string; fileName?: string }) {
  if (message.type === 'text') return message.text || null;
  if (message.type === 'image') return '（画像）';
  if (message.type === 'sticker') return '（スタンプ）';
  if (message.type === 'file') return `（ファイル：${message.fileName || '名前なし'}）`;
  return null;
}
export function chatworkGroupBody(label: string | null | undefined, name: string, text: string) {
  const safe = (value: string) => value.replace(/\[/g, '［').replace(/\]/g, '］');
  return `[info][title]LINE グループ「${safe(label || '（名前なし）')}」[/title]${safe(name)}：${safe(text)}[/info]`;
}
