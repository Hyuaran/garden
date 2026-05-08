"use client";

import Link from "next/link";

interface DuplicateEntry {
  transfer_id: string;
  payee_name: string;
  amount: number;
  scheduled_date: string | null;
  status: string;
}

interface Props {
  duplicates: DuplicateEntry[];
  onForceContinue: () => void;
  continueLabel?: string;
}

export function DuplicateWarning({
  duplicates,
  onForceContinue,
  continueLabel = "承知の上で登録する",
}: Props) {
  if (duplicates.length === 0) return null;

  return (
    <div
      role="alert"
      className="bg-amber-50 border border-amber-300 rounded-lg p-4 my-3"
    >
      <div className="flex items-start gap-2">
        <span className="text-xl">⚠️</span>
        <div className="flex-1">
          <h3 className="font-medium text-amber-900">
            同条件の振込が {duplicates.length} 件あります
          </h3>
          <p className="text-xs text-amber-800 mt-1">
            振込予定日・銀行・口座・金額が同じ未完了の振込です。重複の可能性があります。
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {duplicates.map((d) => (
              <li key={d.transfer_id}>
                <Link
                  href={`/bud/transfers/${d.transfer_id}`}
                  className="text-amber-900 font-mono underline hover:text-amber-700"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {d.transfer_id}
                </Link>
                <span className="text-amber-800 ml-2">
                  {d.payee_name} / ¥{d.amount.toLocaleString()} /{" "}
                  {d.scheduled_date ?? "—"} / {d.status}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onForceContinue}
            className="mt-3 text-xs bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-700"
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
