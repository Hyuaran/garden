"use client";
import { useRouter } from "next/navigation";
import DataTable, { type DataColumn } from "@/app/system/_components/DataTable/DataTable";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { useStoredView } from "@/lib/ui/useStoredView";
import type { AdminListItem } from "./_lib/onboarding-admin";
import styles from "./onboarding.module.css";
const columns: DataColumn<AdminListItem>[] = [
  { id: "name", label: "氏名", type: "text", value: row => row.name },
  { id: "hireDate", label: "入社日", type: "date", value: row => row.hireDate ?? "", render: row => row.hireDate ?? "未入力" },
  { id: "status", label: "状態", align: "mark", type: "text", value: row => row.status === "submitted" ? "提出ずみ" : row.status === "not_started" ? "未着手" : "入力中" },
  { id: "missing", label: "未入力", type: "number", value: row => row.missingCount, render: row => row.missingCount ? `${row.missingCount}件` : "なし" },
  { id: "admin", label: "事務入力", align: "mark", type: "text", value: row => row.adminComplete ? "済" : "未" },
];
/** 完了＝本人が提出ずみで、事務入力も済んでいる */
export const adminRowComplete = (row: AdminListItem) => row.status === "submitted" && row.adminComplete;
export default function AdminOnboardingList({ rows }: { rows: AdminListItem[] }) {
  const router = useRouter();
  const [hideComplete, setHideComplete, ready] = useStoredView("onboarding-all:hide-complete", true, raw => raw !== "false", value => String(value));
  return <main {...CLARITY_MASK}><DataTable loading={!ready} rows={hideComplete ? rows.filter(row => !adminRowComplete(row)) : rows} columns={columns} rowKey={row => row.employeeId}
    searchText={row => `${row.name} ${row.nameKana ?? ""}`} searchPlaceholder="氏名・カナで探す" defaultSort={{ id: "name", direction: "asc" }}
    onRowClick={row => router.push(`/system/onboarding/admin/${encodeURIComponent(row.employeeId)}`)} />
    <label className={styles.hireCheck}><input type="checkbox" checked={hideComplete} onChange={e => setHideComplete(e.target.checked)} />完了を表示しない</label></main>;
}
