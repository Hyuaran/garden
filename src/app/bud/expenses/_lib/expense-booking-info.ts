import { calculateFiscalPeriod } from "./fiscal-period";

export type BookingCorporation = {
  id: string;
  established_on?: string | null;
  fiscal_end_month?: number | null;
};

export function bookingFiscalPeriod(
  corporation: BookingCorporation | undefined,
  receiptDate: string | null,
) {
  if (!corporation) return null;
  const result = calculateFiscalPeriod(corporation.established_on, corporation.fiscal_end_month, receiptDate);
  return result ? `第${result.periodNo}期` : null;
}

export function isBookingComplete(row: { booking_date: string | null | undefined }) {
  return Boolean(row.booking_date);
}
