"use client";

import { KandenStatus, STATUS_LABELS } from "../../_lib/types";
import { colors } from "../../_constants/colors";

const STATUS_COLORS: Record<
  KandenStatus,
  { bg: string; text: string }
> = {
  ordered:           { bg: colors.statusOrdered,         text: colors.statusOrderedText },
  awaiting_specs:    { bg: colors.statusAwaitingSpecs,    text: colors.statusAwaitingSpecsText },
  awaiting_entry:    { bg: colors.statusAwaitingEntry,    text: colors.statusAwaitingEntryText },
  awaiting_sending:  { bg: colors.statusAwaitingSending,  text: colors.statusAwaitingSendingText },
  awaiting_invoice:  { bg: colors.statusAwaitingInvoice,  text: colors.statusAwaitingInvoiceText },
  awaiting_payment:  { bg: colors.statusAwaitingPayment,  text: colors.statusAwaitingPaymentText },
  awaiting_payout:   { bg: colors.statusAwaitingPayout,   text: colors.statusAwaitingPayoutText },
  completed:         { bg: colors.statusCompleted,        text: colors.statusCompletedText },
};

interface Props {
  status: KandenStatus;
  compact?: boolean;
}

export function StatusBadge({ status, compact = false }: Props) {
  const c = STATUS_COLORS[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: compact ? "2px 7px" : "3px 10px",
        borderRadius: 20,
        background: c.bg,
        color: c.text,
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
