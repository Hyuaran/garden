export type AddressFields = { postal: string; address: string; building: string };
export function normalizeAddress(value: string): string {
  return value.replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/([0-9])[－‐‑‒–—―−ーｰ﹣](?=[0-9])/g, "$1-")
    .replace(/[\s　]+/g, " ").trim();
}
export function postalDigits(value: string): string { return normalizeAddress(value).replace(/[^0-9]/g, ""); }
export function validPostal(value: string): boolean { return !normalizeAddress(value) || /^[0-9]{7}$/.test(postalDigits(value)); }
export function composeAddress(fields: AddressFields): string {
  const digits = postalDigits(fields.postal);
  return [digits ? `〒${digits.slice(0, 3)}-${digits.slice(3)}` : "", normalizeAddress(fields.address), normalizeAddress(fields.building)].filter(Boolean).join(" ");
}
export function splitAddress(value: string): AddressFields {
  let rest = normalizeAddress(value);
  const match = rest.match(/^〒?([0-9]{3})-?([0-9]{4})(?= |$)/);
  const postal = match ? `${match[1]}-${match[2]}` : "";
  if (match) rest = rest.slice(match[0].length).trim();
  const space = rest.indexOf(" ");
  return { postal, address: space < 0 ? rest : rest.slice(0, space), building: space < 0 ? "" : rest.slice(space + 1) };
}
