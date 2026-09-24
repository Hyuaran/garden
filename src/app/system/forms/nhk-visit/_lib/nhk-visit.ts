export const NHK_VISIT_DESTINATIONS = ["NHK奈良", "NHK京都", "NHK大阪", "NHK大津", "NHK神戸"] as const;
export const NHK_VISIT_TASK_NAME = "対面アプローチ";
export const NHK_VISIT_TRANSPORT_FEES = ["あり", "なし"] as const;

export type NhkVisitDestination = (typeof NHK_VISIT_DESTINATIONS)[number];
export type NhkVisitTransportFee = (typeof NHK_VISIT_TRANSPORT_FEES)[number];

export type NhkVisitCounts = {
  newGround: number;
  newSatellite: number;
  addressGround: number;
  addressSatellite: number;
  bankCredit: number;
};

export type NhkVisitReportMessageInput = NhkVisitCounts & {
  visitDate: string;
  startTime: string;
  endTime: string;
  destination: NhkVisitDestination;
  taskName?: string;
  transportFee: NhkVisitTransportFee;
};

export function formatVisitDate(value: string) {
  return value.replace(/-/g, "/");
}

export function formatCompactVisitDate(value: string) {
  const [, month, day] = value.split("-");
  return `${month}/${day}`;
}

export function calculateNhkVisitTotals(input: NhkVisitCounts) {
  const newTotal = input.newGround + input.newSatellite;
  const addressTotal = input.addressGround + input.addressSatellite;
  return {
    newTotal,
    addressTotal,
    contractTotal: newTotal + addressTotal + input.bankCredit,
  };
}

export function buildNhkVisitReportMessage(input: NhkVisitReportMessageInput) {
  const totals = calculateNhkVisitTotals(input);
  return [
    `【日付】${formatVisitDate(input.visitDate)}`,
    `【時間】${input.startTime}〜${input.endTime}`,
    `【派遣先】${input.destination}`,
    `【業務】${input.taskName ?? NHK_VISIT_TASK_NAME}`,
    "【成約件数】",
    `　■新規　${totals.newTotal}件（地上${input.newGround}件、衛星${input.newSatellite}件）`,
    `　■住所変更　${totals.addressTotal}件（地上${input.addressGround}件、衛星${input.addressSatellite}件）`,
    `　■口座・クレ　${input.bankCredit}件`,
    `【交通費】${input.transportFee}`,
  ].join("\n");
}

export function weekdayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return ["日", "月", "火", "水", "木", "金", "土"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}
