import type { ContractCompany, ContractDraft } from "./contract-types";
const normalize = (s: string) =>
  s.replace(/[\s　]+/g, "").replace(/[｢｣]/g, (m) => (m === "｢" ? "「" : "」"));
const toIsoDate = (text: string) => {
  let m = text.match(/令和(\d+)年(\d+)月(\d+)日/);
  if (m)
    return `${2018 + Number(m[1])}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = text.match(/(20\d{2})年(\d+)月(\d+)日/);
  if (!m) m = text.match(/(20\d{2})\/(\d{1,2})\/(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : "";
};
function partyBefore(text: string, label: "甲" | "乙") {
  const marker = new RegExp(
    `[（(](?:以下)?[、,]?[「『]?${label}[」』]?(?:という)[。.]?[）)]`,
  );
  const match = marker.exec(text);
  if (!match) return "";
  const before = text.slice(Math.max(0, match.index - 50), match.index);
  return (
    before
      .split(/[。\n]|(?:と(?=[^と]{0,35}$))/)
      .at(-1)
      ?.replace(/^[、,]/, "")
      .replace(/^.*(?:契約書|覚書|通知書)/, "")
      .slice(-30) ?? ""
  );
}
export function extractContract(
  sourcePages: string[],
  companies: ContractCompany[],
): ContractDraft {
  const pages = sourcePages.map(normalize);
  const all = pages.join("\n");
  if (!all)
    return {
      counterparty: "",
      companyId: "",
      contractType: "",
      concludedOn: "",
      note: "",
      partyA: "",
      partyB: "",
      ownParty: null,
      ownPartyWarning: false,
      scanned: true,
    };
  let partyA = partyBefore(all, "甲"),
    partyB = partyBefore(all, "乙");
  const own = companies.find((c) => all.includes(normalize(c.company_name)));
  if (!partyB && own) partyB = own.company_name;
  if (!partyA) {
    const firstMarker = all.search(/[（(](?:以下)?[、,]?[「『]?甲/);
    if (firstMarker >= 0)
      partyA = all.slice(Math.max(0, firstMarker - 30), firstMarker);
  }
  const ownA = companies.find((c) =>
    normalize(partyA).includes(normalize(c.company_name)),
  );
  const ownB = companies.find((c) =>
    normalize(partyB).includes(normalize(c.company_name)),
  );
  const ownParty = ownA ? "A" : ownB ? "B" : null;
  const company = ownA ?? ownB ?? own;
  // 見出しは1ページ目の先頭にあるため最初のマッチを採る。
  // 最後のマッチだと本文中の「〜通知書」等を拾ってしまう（実PDFで確認）。
  // 先頭に付くページ番号は落とす。
  const heading = (
    (pages[0]?.match(/([^。]{2,40}(?:契約書|覚書|通知書))/g) ?? []).at(0) ?? ""
  ).replace(/^\d+/, "");
  const dates =
    all.match(
      /令和\d+年\d+月\d+日|20\d{2}年\d+月\d+日|20\d{2}\/\d{1,2}\/\d{1,2}/g,
    ) ?? [];
  return {
    counterparty: ownParty === "A" ? partyB : partyA,
    companyId: company?.company_id ?? "",
    contractType: heading,
    concludedOn: toIsoDate(dates.at(-1) ?? ""),
    note: "",
    partyA,
    partyB,
    ownParty,
    ownPartyWarning: ownParty === "A",
    scanned: false,
  };
}
