export type BodySegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

const HTTP_URL = /https?:\/\/[A-Za-z0-9][A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]*/gi;
const TRAILING_PUNCTUATION = /[)\]}>」』】〕〉》。、，．,.;:!?！？]+$/;

export function linkifyBodyText(value: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let cursor = 0;
  for (const match of value.matchAll(HTTP_URL)) {
    const start = match.index;
    const matched = match[0];
    const href = matched.replace(TRAILING_PUNCTUATION, "");
    if (!href || !isHttpUrl(href)) continue;
    if (start > cursor) segments.push({ type: "text", text: value.slice(cursor, start) });
    segments.push({ type: "link", text: href, href });
    cursor = start + href.length;
  }
  if (cursor < value.length) segments.push({ type: "text", text: value.slice(cursor) });
  return segments.length ? segments : [{ type: "text", text: value }];
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch { return false; }
}
