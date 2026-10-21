export type FontSize = "s" | "m" | "l";
export const fontZoom = { s: 0.9, m: 1, l: 1.15 };
export const fontLabel = { s: "小", m: "中", l: "大" };
export const nextFontSize = { s: "m", m: "l", l: "s" } as const;
export function readFontSize(userId: string | null): FontSize {
  try {
    const value = userId && localStorage.getItem(`garden-font-size:${userId}`);
    if (value === "s" || value === "l") return value;
  } catch {}
  return "m";
}
export function applyFontSize(size: FontSize) {
  document.documentElement.style.zoom = String(fontZoom[size]);
  document.documentElement.dataset.fontSize = size;
  window.dispatchEvent(new Event("garden-font-size-change"));
}
export function rootZoom() {
  return Number.parseFloat(document.documentElement.style.zoom) || 1;
}
// ローカル認証セッションから本人の ID のみを取得。通信しない。
export const initialFontSizeScript = `(() => {
  let size = "m";
  try {
    const project = ${JSON.stringify((process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").split("//")[1]?.split(".")[0] ?? "")};
    const key = "sb-" + project + "-auth-token";
    const cookies = Object.fromEntries(document.cookie.split("; ").filter(Boolean).map(part => {
      const index = part.indexOf("=");
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }));
    let raw = cookies[key] || "";
    for (let i = 0; cookies[key + "." + i]; i++) raw += cookies[key + "." + i];
    if (raw.startsWith("base64-")) raw = atob(raw.slice(7).replace(/-/g, "+").replace(/_/g, "/"));
    const session = JSON.parse(raw || localStorage.getItem(key) || "null");
    const id = session?.user?.id;
    const saved = id && localStorage.getItem("garden-font-size:" + id);
    if (saved === "s" || saved === "l") size = saved;
  } catch {}
  document.documentElement.dataset.fontSize = size;
  document.documentElement.style.zoom = ({s: "0.9", m: "1", l: "1.15"})[size];
})();`;
