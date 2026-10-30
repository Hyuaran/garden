/** Shared by global search and its destination tables. No query is persisted. */
export function normalizeSearch(value: unknown, phone = false): string {
  const text = String(value ?? "").normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/(?<=\d),(?=\d)/g, "").replace(/(\d)\/(\d)/g, "$1-$2");
  return phone ? text.replace(/[-‐‑‒–—−ー\s]/g, "") : text;
}
export function validSearch(query: string) {
  const text = normalizeSearch(query).trim();
  return !!text && (!/^[a-z0-9,\s]+$/i.test(text) || text.replace(/[,\s]/g, "").length >= 2);
}
export function searchRank(value: unknown, query: string, phone = false) {
  const text = normalizeSearch(value, phone), needle = normalizeSearch(query.trim(), phone);
  return text === needle ? 0 : text.startsWith(needle) ? 1 : text.includes(needle) ? 2 : -1;
}
export type SearchHit = { id: string; title: string; label: string; value: string; module: string; href: string; rank: number; updated: string; phone?: boolean };
export type SearchGroup = { key: string; label: string; hits: SearchHit[]; more: boolean };
export function limitHits(hits: SearchHit[], limit: number) {
  const sorted = [...hits].sort((a, b) => a.rank - b.rank || b.updated.localeCompare(a.updated) || a.id.localeCompare(b.id));
  return { hits: sorted.slice(0, limit), more: sorted.length > limit };
}
/** Track original offsets so NFKC, commas and phone hyphens still highlight the actual match. */
export function matchRange(value: string, query: string, phone = false): [number, number] | null {
  const normalized = normalizeSearch(value, phone), needle = normalizeSearch(query.trim(), phone);
  const start = normalized.indexOf(needle);
  if (start < 0 || !needle) return null;
  let from = 0, to = value.length;
  for (let i = 0; i <= value.length; i++) {
    const length = normalizeSearch(value.slice(0, i), phone).length;
    if (length <= start) from = i;
    if (length >= start + needle.length) { to = i; break; }
  }
  return [from, to];
}
