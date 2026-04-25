/**
 * 月次通知テンプレート（scaffold §4.5 準拠）
 *
 * 毎月 14 日 18:00 (JST) 配信（翌日 15-20 日の責任者会議前日の周知）。
 * 本文では PDF URL を紹介、サムネイル画像は uploadFile で別途添付。
 */

export type MonthlyInput = {
  /** "2026年5月" など表示用 */
  month: string;
  /** PDF ダウンロード URL */
  pdfUrl: string;
  /** 差出人（既定: "東海林"） */
  sender?: string;
  /** 補足メッセージ（任意） */
  note?: string;
};

export function renderMonthly(input: MonthlyInput): string {
  const sender = input.sender ?? "東海林";
  const lines = [
    `[info][title]📆 ${input.month} 月次ダイジェスト（明日の会議資料）[/title]`,
    `${sender}です。明日の責任者会議用の月次ダイジェストを添付します。`,
    ``,
    `📄 PDF: ${input.pdfUrl}`,
    `🖼️ サムネイル画像（各ページ）: 本メッセージに添付`,
    ``,
  ];
  if (input.note) {
    lines.push(input.note, "");
  }
  lines.push(`会議前にご確認ください。`, `[/info]`);
  return lines.join("\n");
}
