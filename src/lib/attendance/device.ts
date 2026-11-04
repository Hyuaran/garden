export function attendanceDevice(headers: Headers): "pc" | "smartphone" {
  return headers.get("sec-ch-ua-mobile") === "?1" ||
    /Mobi|Android|iPhone|iPad/i.test(headers.get("user-agent") || "")
    ? "smartphone"
    : "pc";
}
export function deviceLabel(value: string | null | undefined) {
  return value === "pc" ? "PC" : value === "smartphone" ? "スマホ" : "—";
}
