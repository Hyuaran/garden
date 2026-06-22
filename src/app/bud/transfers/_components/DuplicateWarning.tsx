"use client";

import Link from "next/link";
import { transferFormStyles as styles } from "./transferFormStyles";

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
      className="my-3 rounded-[12px] border border-[rgba(212,165,65,0.32)] bg-[rgba(212,165,65,0.12)] p-4"
    >
      <div className="flex items-start gap-2">
        <span className="text-xl text-accent-gold">!</span>
        <div className="flex-1">
          <h3 className="font-shippori font-semibold text-text-main">
            同条件の振込が {duplicates.length} 件あります
          </h3>
          <p className="mt-1 text-xs text-text-sub">
            振込予定日・銀行・口座・金額が同じ未完了の振込です。重複の可能性があります。
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {duplicates.map((d) => (
              <li key={d.transfer_id}>
                <Link
                  href={`/bud/transfers/${d.transfer_id}`}
                  className="font-mono text-text-main underline transition hover:text-[#b3892e]"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {d.transfer_id}
                </Link>
                <span className="ml-2 text-text-sub">
                  {d.payee_name} / ¥{d.amount.toLocaleString()} /{" "}
                  {d.scheduled_date ?? "—"} / {d.status}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onForceContinue}
            className={`${styles.smallGoldButton} mt-3 text-xs`}
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
