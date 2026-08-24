export type ExpenseBookingGroupItem = {
  id: string;
  applicantKey: string | null;
  applicantName: string;
  receiptDate: string | null;
  amount: number;
  selectable: boolean;
};

export type ExpenseBookingGroup<T extends ExpenseBookingGroupItem> = {
  key: string;
  applicantName: string;
  items: T[];
  count: number;
  totalAmount: number;
  selectableIds: string[];
};

const UNASSIGNED_KEY = "__unassigned__";

export function groupExpenseBookingRows<T extends ExpenseBookingGroupItem>(rows: T[]): ExpenseBookingGroup<T>[] {
  const groups = new Map<string, { applicantName: string; indexedItems: Array<{ item: T; index: number }> }>();
  rows.forEach((item, index) => {
    const key = item.applicantKey ?? UNASSIGNED_KEY;
    const current = groups.get(key) ?? { applicantName: item.applicantKey ? item.applicantName : "未設定", indexedItems: [] };
    current.indexedItems.push({ item, index });
    groups.set(key, current);
  });

  return Array.from(groups, ([key, group]) => {
    const items = group.indexedItems
      .slice()
      .sort((left, right) => compareReceiptDate(left.item.receiptDate, right.item.receiptDate) || left.index - right.index)
      .map(({ item }) => item);
    return {
      key,
      applicantName: group.applicantName,
      items,
      count: items.length,
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
      selectableIds: items.filter((item) => item.selectable).map((item) => item.id),
    };
  }).sort((left, right) => {
    if (left.key === UNASSIGNED_KEY) return 1;
    if (right.key === UNASSIGNED_KEY) return -1;
    return left.applicantName.localeCompare(right.applicantName, "ja");
  });
}

export function getGroupSelectionState(selectableIds: string[], selectedIds: ReadonlySet<string>) {
  const selectedCount = selectableIds.filter((id) => selectedIds.has(id)).length;
  return {
    checked: selectableIds.length > 0 && selectedCount === selectableIds.length,
    partial: selectedCount > 0 && selectedCount < selectableIds.length,
    selectedCount,
  };
}

export function updateGroupSelection(
  selectedIds: ReadonlySet<string>,
  selectableIds: string[],
  checked: boolean,
) {
  const next = new Set(selectedIds);
  for (const id of selectableIds) {
    if (checked) next.add(id);
    else next.delete(id);
  }
  return next;
}

export function summarizeExpenseBookingSelection<T extends Pick<ExpenseBookingGroupItem, "id" | "amount" | "selectable">>(
  rows: T[],
  selectedIds: ReadonlySet<string>,
) {
  const selected = rows.filter((row) => row.selectable && selectedIds.has(row.id));
  return {
    totalCount: rows.length,
    totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    selectedCount: selected.length,
    selectedAmount: selected.reduce((sum, row) => sum + row.amount, 0),
    invalidCount: rows.filter((row) => !row.selectable).length,
  };
}

export function calculateTaxExcludedAmount(taxIncludedAmount: number) {
  return Math.floor((taxIncludedAmount * 10) / 11);
}

function compareReceiptDate(left: string | null, right: string | null) {
  if (left === right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}
