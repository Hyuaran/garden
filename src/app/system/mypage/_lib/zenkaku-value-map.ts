/**
 * Kintone field code -> FileMaker value -> Kintone option value.
 * Add confirmed probe results here; conversion logic does not need changing.
 * Other fields intentionally remain empty until the FileMaker distribution probe is reviewed.
 */
export const ZENKAKU_VALUE_MAP: Record<string, Record<string, string>> = {
  工事種別: {
    新規: "新設　新規",
  },
};

export function mapZenkakuDropdownValue(field: string, raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const value = String(raw).trim();
  if (!value) return "";
  return ZENKAKU_VALUE_MAP[field]?.[value] ?? value;
}
