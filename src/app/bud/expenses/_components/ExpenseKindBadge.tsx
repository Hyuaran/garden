import { expenseKindLabel } from "../_lib/expense-kind";

export function ExpenseKindBadge({ kind }: { kind: string | null | undefined }) {
  if (expenseKindLabel(kind) !== "会社経費") return null;
  return <span style={badge}>会社経費</span>;
}

const badge: React.CSSProperties = { display: "inline-block", maxWidth: 96, marginRight: 6, padding: "2px 7px", overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "middle", whiteSpace: "nowrap", border: "1px solid var(--teal-d)", borderRadius: 8, background: "var(--sub)", color: "var(--teal-d)", fontSize: 11, fontWeight: 800 };
