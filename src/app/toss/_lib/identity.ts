export function normalizePartnerCode(partnerCode: string): string {
  const normalized = partnerCode.trim();
  if (!/^\d{7}$/.test(normalized)) {
    throw new Error("パートナーコードは半角数字7桁で入力してください");
  }
  return normalized;
}

export function toTossEmail(partnerCode: string): string {
  return `toss${normalizePartnerCode(partnerCode)}@toss.garden.internal`;
}

