import type { BroadcastTemplate } from '@/lib/line/broadcast-template';
export function fillTemplate(text: string, now = new Date()) {
 const jst = new Date(now.getTime() + 9 * 3600 * 1000);
 const year = jst.getUTCFullYear();
 const values: Record<string,string> = { 年: String(year), 月: String(jst.getUTCMonth()+1), 令和: String(year-2018) };
 return text.replace(/\{(年|月|令和)\}/g, (_, key: string) => values[key]);
}
/** 定型文のタグ（種類＋名前）を、今あるタグの id に直す。見つからないタグがあれば名前を返す */
export function templateTagIds(template: BroadcastTemplate, tags: { id: string; kind: string; name: string }[]) {
  const ids: string[] = [];
  const missing: string[] = [];
  for (const want of template.tags) {
    const tag = tags.find(t => t.kind === want.kind && t.name === want.name);
    if (tag) ids.push(tag.id); else missing.push(want.name);
  }
  return { ids, missing };
}
