export function normalizeKanriNo(s: string): string | null {
  const number = s
    .replace(/[０-９（）]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .trim()
    .replace(/\s*\([0-9]+\)$/, "")
    .replace(/^PD/i, "")
    .trim();

  return /^[0-9]+$/.test(number) ? number.replace(/^0+(?=\d)/, "") : null;
}
