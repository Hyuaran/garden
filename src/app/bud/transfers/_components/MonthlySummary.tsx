import type { BudTransfer } from "../../_constants/types";

interface MonthlySummaryProps {
  transfers: BudTransfer[];
}

function formatYen(n: number): string {
  return `¥${n.toLocaleString()}`;
}

export function MonthlySummary({ transfers }: MonthlySummaryProps) {
  const total = transfers.reduce((sum, t) => sum + t.amount, 0);
  const count = transfers.length;
  const pendingCount = transfers.filter(
    (t) => !["振込完了", "差戻し"].includes(t.status),
  ).length;

  return (
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-xs text-gray-500">件数</div>
        <div className="text-2xl font-bold text-gray-800">{count}</div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-xs text-gray-500">合計金額</div>
        <div className="text-2xl font-bold text-gray-800">
          {formatYen(total)}
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-xs text-gray-500">処理中（未完了・未差戻し）</div>
        <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
      </div>
    </div>
  );
}
