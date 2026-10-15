/**
 * 支払漏れチェックの業者マスタ。
 * 元＝C:\Claude\002_Microsoft365\10_メール支払漏れチェック\vendors.json（初版 2026-10-15・Microsoft365 セッション作成）。
 * 業者を足す・直すときはこのファイルと vendors.json の両方を直す。
 * senderMatch＝差出人と件名をつなげた文字への部分一致（| で複数・大文字小文字は区別しない）
 * kintoneName＝振込依頼「お支払い先」の部分一致／driveName＝保存 PDF 名の部分一致
 * dueRule＝month-end（月末）／plus2-end（受信月の 2 か月後の月末）／day:N（月の N 日頃）／plus2:N（翌々月 N 日頃）／unknown（請求書を見ないと分からない）
 * 2026-10-15：実績の少なかった 4 社を振込依頼の過去の支払期日から確定（第一ビルディング＝25 日・プロディライト＝月末・ディップ＝受信月の 2 か月後の月末・西村産業＝月末）。京セラは振込依頼に記録が無い（口座振替の可能性）ので未確定のまま
 * confirmed=false は実績が足りない業者＝漏れがあっても「人の確認が必要」として 1 回だけ知らせる
 */
export type DriveRoot = "pay" | "ses";

export type DueRule = "month-end" | "plus2-end" | `day:${number}` | `plus2:${number}` | "unknown";

export type Vendor = {
  key: string;
  senderMatch: string;
  kintoneName: string;
  driveRoot: DriveRoot;
  driveName: string;
  payer: string;
  dueRule: DueRule;
  confirmed: boolean;
  note?: string;
};

/** 02_支払 明細（01_経理部）と 08_SES事業部／明細・請求書 のフォルダ ID */
export const DRIVE_ROOT_IDS: Record<DriveRoot, string> = {
  pay: "1CE-Yu8ICfQxpEMNuT5rVd_vV91PTKIc9",
  ses: "11ElkauoYT-ZmuxA1j3XRJC_yCzzJ4-SO",
};

export const DRIVE_ROOT_LABELS: Record<DriveRoot, string> = {
  pay: "02_支払 明細",
  ses: "08_SES事業部／明細・請求書",
};

export const VENDORS: Vendor[] = [
  { key: "ICES", senderMatch: "ices.co.jp", kintoneName: "ICES", driveRoot: "pay", driveName: "ICES", payer: "株式会社ヒュアラン", dueRule: "day:27", confirmed: true },
  { key: "ラソ", senderMatch: "lazo0901", kintoneName: "ラソ", driveRoot: "pay", driveName: "ラソ", payer: "株式会社ヒュアラン", dueRule: "month-end", confirmed: true },
  { key: "クールジャパン", senderMatch: "cooljpn", kintoneName: "クールジャパン", driveRoot: "ses", driveName: "クールジャパン", payer: "株式会社センターライズ", dueRule: "day:10", confirmed: true, note: "SES は 08_SES事業部 に金さんが月 1 で保存。vendors.json は「翌々月10日頃」（利用月から数えて）＝受信日から見ると次の 10 日（実績：2026-09-30 受信の 8 月分→10-09 支払）" },
  { key: "KOSMO", senderMatch: "kosmo.net", kintoneName: "KOSMO", driveRoot: "pay", driveName: "KOSMO", payer: "株式会社ヒュアラン", dueRule: "month-end", confirmed: true },
  { key: "賃貸経営サポート(Duo心斎橋)", senderMatch: "attovas", kintoneName: "賃貸経営サポート", driveRoot: "pay", driveName: "Duo心斎橋", payer: "株式会社ヒュアラン", dueRule: "month-end", confirmed: true },
  { key: "第一ビルディング(サンマリオンタワー)", senderMatch: "第一ビルディング", kintoneName: "第一ビルディング", driveRoot: "pay", driveName: "第一ビルディング", payer: "株式会社ヒュアラン", dueRule: "day:25", confirmed: true, note: "家賃（翌月分）＋前々月の電気代。毎月 25 日（休みなら前の営業日）" },
  { key: "トップウェイ", senderMatch: "topway", kintoneName: "トップウェイ", driveRoot: "pay", driveName: "トップウェイ", payer: "株式会社ヒュアラン", dueRule: "month-end", confirmed: true, note: "金額が変わった月は振込で予約し直し" },
  { key: "楽天カード(リンクサポート)", senderMatch: "infomart.*楽天カード|楽天カード", kintoneName: "楽天カード", driveRoot: "pay", driveName: "楽天カード", payer: "株式会社リンクサポート", dueRule: "month-end", confirmed: true },
  { key: "プロディライト(請求書)", senderMatch: "system@prodelight", kintoneName: "プロディライト", driveRoot: "pay", driveName: "プロディライト", payer: "株式会社リンクサポート", dueRule: "month-end", confirmed: true, note: "イノベラ利用料。月の中ごろに届き月末払い" },
  { key: "ディップ(dip)", senderMatch: "dip-net", kintoneName: "ディップ", driveRoot: "pay", driveName: "ディップ", payer: "株式会社ヒュアラン", dueRule: "plus2-end", confirmed: true, note: "バイトル掲載費。利用月の末ごろに届き 2 か月後の月末払い（例：9/28 着の 9 月分→11/30）" },
  { key: "京セラ(リンクサポート)", senderMatch: "infomart.*京セラ|京セラ", kintoneName: "京セラ", driveRoot: "pay", driveName: "京セラ", payer: "株式会社リンクサポート", dueRule: "unknown", confirmed: false },
  { key: "西村産業", senderMatch: "yoshihawaiian@gmail", kintoneName: "西村産業", driveRoot: "pay", driveName: "西村産業", payer: "株式会社ヒュアラン", dueRule: "month-end", confirmed: true, note: "ブレーカー工事費。月末払い。2026-09 は意図的に未払いの分あり（東海林さん判断）" },
];

export function findVendor(sender: string, subject: string, vendors: Vendor[] = VENDORS): Vendor | null {
  const text = `${sender} ${subject}`;
  return vendors.find((vendor) => new RegExp(vendor.senderMatch, "i").test(text)) ?? null;
}
