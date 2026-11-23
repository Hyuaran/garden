import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { formatCustomerNumber, formatSupplyPoint } from "@/lib/leaf-kanden/sales-form";
import { acquisitionLabel, urgentLabel, type FormInput } from "@/lib/leaf-kanden/submissions";
import styles from "./sales-form.module.css";

export default function KandenSummary({ row, count, specs }: {
  row: Omit<FormInput, "kanri_no_raw"> & { kanri_no_raw: string | null };
  count: number;
  specs: string;
}) {
  const values = [
    ["獲得種類", row.acquisition], ["PD番号", row.kanri_no_raw || "未入力"],
    ["獲得内容", acquisitionLabel(row)],
    ["写メ", `${count} 枚`], ["諸元", specs], ["メモ", row.note || "—"],
    ...(row.customer ? [
      ["照合結果", row.customer.outside ? "リスト外" : "リスト照合済み"],
      ["リスト名", row.customer.listName ?? ""],
      ["カナ", row.customer.kana], ["住所", row.customer.address], ["電話", row.customer.phone],
      ["契約種別", row.customer.contract],
      ["供給地点番号", formatSupplyPoint(row.customer.supply)],
    ].filter(([, value]) => value) : []),
  ];
  return <>
    <p className={styles.confirmText}>申込書の内容と一致しているか、お客様と照らし合わせてください。</p>
    {row.urgent_sw && <p className={styles.urgentConfirm}>至急SW　{urgentLabel(row)}</p>}
    <div className={styles.confirmNumber} {...CLARITY_MASK}>
      <span>関電お客様番号（14桁）</span>
      <strong>{formatCustomerNumber(row.customer?.number ?? "") || "—"}</strong>
      <span>{row.customer_name}</span>
    </div>
    <dl className={styles.confirmDetails}>{values.map(([label, value]) => <div key={label}>
      <dt>{label}</dt><dd {...CLARITY_MASK}>{value}</dd>
    </div>)}</dl>
  </>;
}
