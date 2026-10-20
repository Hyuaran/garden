export const corporations: Record<string, string> = { HR: "ヒュアラン", CR: "センターライズ", LKS: "リンクサポート", ART: "ARATA", TIY: "たいよう", 壱: "壱", STB: "ストーンベース" };
export function accountAxes(name: string) {
 const parts = name.split("｜"); const code = parts.length === 2 ? parts[1].trim() : "";
 return { bank_name: parts[0].trim() || "その他", corp_code: Object.hasOwn(corporations, code) ? code : "other" };
}
export const corporationName = (code: string) => corporations[code] ?? "その他";

// 画面には略号を出さない（東海林さん 2026-10-20「HR 等略さずヒュアラン等会社名で」）：「オリコカード｜HR」→「オリコカード（ヒュアラン）」
export function accountDisplayName(name: string) {
 const parts = name.split("｜");
 if (parts.length !== 2) return name;
 const code = parts[1].trim();
 return `${parts[0].trim()}（${corporations[code] ?? code}）`;
}
