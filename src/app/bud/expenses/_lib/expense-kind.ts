export function expenseKindLabel(value: string | null | undefined) {
  if (value === "individual") return "個人経費";
  if (value === "company") return "会社経費";
  return value ?? "";
}
