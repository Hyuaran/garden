/** 注入 HTML の非許可タブは中身ごと除外する（CSS で隠すだけにしない）。 */
export function filterBudViewHtml(html: string, tabs: readonly { key: string; allowed: boolean }[]) {
  const denied = new Set(tabs.filter(tab => !tab.allowed).map(tab => tab.key));
  if (!denied.size) return html;
  const tokens = /<\/?([a-z][\w-]*)\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  let skip: { start: number; name: string; depth: number } | undefined;
  const ranges: [number, number][] = [];
  while ((match = tokens.exec(html))) {
    const tag = match[0], name = match[1].toLowerCase(), closing = tag.startsWith("</");
    if (skip) {
      if (name === skip.name) skip.depth += closing ? -1 : 1;
      if (!skip.depth) { ranges.push([skip.start, tokens.lastIndex]); skip = undefined; }
      continue;
    }
    if (closing) continue;
    const tab = tag.match(/data-tab=["']([^"']+)/)?.[1];
    const content = /class=["'][^"']*\btab-content\b/.test(tag) ? tag.match(/id=["']tab-([^"']+)/)?.[1] : undefined;
    if (denied.has(tab ?? content ?? "")) skip = { start: match.index, name, depth: 1 };
  }
  for (const [start, end] of ranges.reverse()) html = html.slice(0, start) + html.slice(end);
  if (!/class=["'][^"']*\btab-item\b[^"']*\bactive\b/.test(html)) {
    const first = html.match(/<(?:button|a)\b[^>]*data-tab=["']([^"']+)["'][^>]*>/);
    if (first) {
      html = html.replace(first[0], first[0].replace(/class=(["'])/, "class=$1active "));
      html = html.replace(new RegExp(`(<div\\b[^>]*class=["'])([^"']*)(["'][^>]*id=["']tab-${first[1]}["'])`), "$1active $2$3");
    }
  }
  return html;
}
