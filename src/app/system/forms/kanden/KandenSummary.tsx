import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { acquisitionLabel, urgentLabel, type FormInput } from "@/lib/leaf-kanden/submissions";
import { FieldGrid, FieldLabel, FixedValue } from "../_components/form-kit";

export default function KandenSummary({ row, count, specs }: {
  row: Omit<FormInput, "kanri_no_raw"> & { kanri_no_raw: string | null };
  count: number;
  specs: string;
}) {
  const values = [
    ["区分", row.acquisition], ["管理番号", row.kanri_no_raw || "未入力"],
    ["お客様名", row.customer_name], ["獲得内容", acquisitionLabel(row)],
    ["至急SW", urgentLabel(row)], ["写メ", `${count} 枚`], ["諸元", specs], ["メモ", row.note || "—"],
  ];
  return <FieldGrid>{values.map(([label, value]) => <FieldLabel key={label} label={label}>
    <FixedValue><span {...CLARITY_MASK}>{value}</span></FixedValue>
  </FieldLabel>)}</FieldGrid>;
}
