export function isReceiptTimeMissing(value: string | null | undefined) {
  return (value ?? "").trim() === "";
}
