import { expenseKindLabel } from "../_lib/expense-kind";

export function ExpenseKindBadge({ kind }: { kind: string | null | undefined }) {
  if (expenseKindLabel(kind) !== "会社経費") return null;
  return <span style={badge}>会社経費</span>;
}

const badge: React.CSSProperties = { display: "inline-block", maxWidth: 96, marginRight: 6, padding: "2px 7px", overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "middle", whiteSpace: "nowrap", border: "1px solid color-mix(in srgb, var(--teal, #0ea5a0) 55%, transparent)", borderRadius: 8, background: "color-mix(in srgb, var(--teal, #0ea5a0) 14%, transparent)", color: "var(--text-main, var(--ink))", fontSize: 11, fontWeight: 700 };
// 以前は灰色の地（--sub）にティールの文字で読みにくかった（東海林さん 2026-10-22）。薄いティールの地＋ふつうの文字色に
