"use client";
import { useRouter } from "next/navigation";
import DataTable, { type DataColumn } from "@/app/system/_components/DataTable/DataTable";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import type { AdminListItem } from "./_lib/onboarding-admin";
import styles from "./onboarding.module.css";
const columns: DataColumn<AdminListItem>[] = [
  { id: "name", label: "氏名", type: "text", value: row => row.name },
  { id: "hireDate", label: "入社日", type: "date", value: row => row.hireDate ?? "", render: row => row.hireDate ?? "未入力" },
  { id: "status", label: "状態", type: "text", value: row => row.status === "submitted" ? "提出ずみ" : "入力中" },
  { id: "missing", label: "未入力", type: "number", value: row => row.missingCount, render: row => row.missingCount ? `${row.missingCount}件` : "なし" },
  { id: "admin", label: "事務入力", type: "text", value: row => row.adminComplete ? "済" : "未" },
];
export default function AdminOnboardingList({ rows }: { rows: AdminListItem[] }) {
  const router = useRouter();
  return <main className={styles.panel} {...CLARITY_MASK}><DataTable rows={rows} columns={columns} rowKey={row => row.employeeId}
    searchText={row => `${row.name} ${row.nameKana ?? ""}`} searchPlaceholder="氏名・カナで探す" defaultSort={{ id: "name", direction: "asc" }}
    onRowClick={row => router.push(`/system/onboarding/admin/${encodeURIComponent(row.employeeId)}`)} /></main>;
}
