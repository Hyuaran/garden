export const paymentColumns = "pd_row_no,statement_month,amount,source_file";

export type PaymentSummary = {
  pd_row_no: string;
  statement_month: string;
  amount: number | null;
  source_file: string | null;
};

const yen = new Intl.NumberFormat("ja-JP");

export default function PaymentDetails({ rows, paidOn, refundedOn }: {
  rows: readonly PaymentSummary[];
  paidOn?: string | null;
  refundedOn?: string | null;
}) {
  const ordered = [...rows].sort((a, b) =>
    b.statement_month.localeCompare(a.statement_month) || a.pd_row_no.localeCompare(b.pd_row_no));
  return <section aria-label="入金明細">
    <h3>入金明細</h3>
    {paidOn && <p>入金日 {paidOn}</p>}
    {refundedOn && <p>戻入日 {refundedOn}</p>}
    {ordered.length ? <ul>
      {ordered.map(row => <li key={row.pd_row_no}>
        {row.statement_month}　{row.amount == null || row.amount === 0 ? "入金・戻入なし" : row.amount < 0 ? "戻入" : "入金"}
        {row.amount == null ? "" : `　${yen.format(row.amount)} 円`}　No. {row.pd_row_no}
        {row.source_file && <small>　{row.source_file}</small>}
      </li>)}
    </ul> : <p>照合済みの入金明細はありません。</p>}
  </section>;
}
