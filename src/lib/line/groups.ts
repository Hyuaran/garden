export type LineGroup = {
  id: string; label: string | null; account: 'dev' | 'official';
  chatwork_room_id: string | null; notify_enabled: boolean; linked_at: string | null;
};
export function parseGroupCode(text: string) {
  // 日本語入力で「-」が「ー」「−」などに化けても、ハイフンなしでも通す
  const normalized = text.normalize('NFKC').replace(/\s/g, '');
  const match = normalized.match(/^連携G[-‐‑‒–—―ー−]?(\d{4})$/i);
  return match ? `G-${match[1]}` : null;
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
