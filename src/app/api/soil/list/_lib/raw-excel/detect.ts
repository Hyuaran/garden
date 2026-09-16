import { HIKARI_HEADERS, KUREKA_HEADERS, type RawKind } from "./constants";

export type RawHeaderDetection =
  | { ok: true; kind: RawKind; header: string[]; positions: Record<string, number>; extra: string[]; missing: string[] }
  | { ok: false; header: string[]; missing: string[]; extra: string[] };

export function normalizeHeaderName(value: string): string {
  return value.replace(/^[\uFEFF\s\u3000]+|[\s\u3000]+$/g, "");
}

export function detectRawKind(headers: string[]): RawHeaderDetection {
  const header = headers.map(normalizeHeaderName).filter(Boolean);
  const positions: Record<string, number> = {};
  header.forEach((name, index) => {
    if (positions[name] === undefined) positions[name] = index;
  });
  const names = new Set(header);
  const expected = names.has("携帯番号") && names.has("申込者名_姓") ? KUREKA_HEADERS : HIKARI_HEADERS;
  const missing = expected.filter((name) => !names.has(name));
  const extra = header.filter((name) => !(expected as readonly string[]).includes(name));
  if (missing.length === 0) {
    return { ok: true, kind: expected === KUREKA_HEADERS ? "kureka" : "hikari", header, positions, extra, missing };
  }
  return { ok: false, header, missing, extra };
}

