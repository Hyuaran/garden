import Link from "next/link";
import StickyTable from "@/app/system/_components/StickyTable/useStickyTable";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { readAdminOnboardingList } from "./_lib/onboarding-admin.server";
import styles from "./onboarding.module.css";
export default function AdminOnboardingList({ rows }: { rows: Awaited<ReturnType<typeof readAdminOnboardingList>> }) {
return <main className={styles.panel}>        {rows?.length ? <div className={styles.tableWrap}><StickyTable className={styles.adminTable}>
          <thead><tr><th>氏名</th><th>入社日</th><th>状態</th><th>未入力</th><th>事務入力</th></tr></thead>
          <tbody {...CLARITY_MASK}>{rows.map(row => <tr key={row.employeeId}>
            <td><Link href={`/system/onboarding/admin/${encodeURIComponent(row.employeeId)}`}>{row.name}</Link></td>
            <td>{row.hireDate ?? "未入力"}</td>
            <td>{row.status === "submitted" ? "提出ずみ" : "入力中"}</td>
            <td>{row.missingCount ? `${row.missingCount}件` : "なし"}</td>
            <td>{row.adminComplete ? "済" : "未"}</td>
          </tr>)}</tbody>
        </StickyTable></div> : <p>まだ入社手続きの入力はありません。</p>}</main>;
}
