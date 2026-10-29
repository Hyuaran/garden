export function validMyNumber(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{12}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 11; i++) sum += digits[10-i] * (i < 6 ? i+2 : i-4);
  const remainder = sum % 11;
  return digits[11] === (remainder <= 1 ? 0 : 11-remainder);
}
