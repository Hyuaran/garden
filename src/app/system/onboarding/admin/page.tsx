import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingError } from "../_lib/onboarding.server";
import { onboardingAdminContext, readAdminOnboardingList } from "../_lib/onboarding-admin.server";
import styles from "../onboarding.module.css";

export const metadata = { title: "入社手続き（事務） | Garden" };

export default async function OnboardingAdminPage() {
  let rows = null;
  let message = "";
  try {
    const context = await onboardingAdminContext();
    rows = await readAdminOnboardingList(context);
  } catch (error) {
    if (error instanceof OnboardingError && error.status === 401) redirect("/login?returnTo=%2Fsystem%2Fonboarding%2Fadmin");
    message = error instanceof OnboardingError ? error.message : "入社手続きを読み込めませんでした。時間をおいて、もう一度お試しください。";
  }
  return <div className={styles.pageShell}>
    <header className={styles.header}><p className={styles.eyebrow}>System ／ 入社手続き（事務）</p><h1>入社手続き（事務）</h1></header>
    {message === "閲覧権限がありません" ? <main className={styles.panel}><h2>閲覧権限がありません</h2><p>この画面は責任者以上が利用できます。</p></main>
      : message ? <main className={styles.panel} role="status"><h2>入社手続きの確認</h2><p>{message}</p></main>
      : <main className={styles.panel}>
        <div className={styles.adminTopActions}><Link className={styles.button} href="/system/onboarding">自分の入社手続きへ</Link></div>
        {rows?.length ? <div className={styles.tableWrap}><table className={styles.adminTable}>
          <thead><tr><th>氏名</th><th>入社日</th><th>状態</th><th>未入力</th><th>事務入力</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.employeeId}>
            <td><Link href={`/system/onboarding/admin/${encodeURIComponent(row.employeeId)}`}>{row.name}</Link></td>
            <td>{row.hireDate ?? "未入力"}</td>
            <td>{row.status === "submitted" ? "提出ずみ" : "入力中"}</td>
            <td>{row.missingCount ? `${row.missingCount}件` : "なし"}</td>
            <td>{row.adminComplete ? "済" : "未"}</td>
          </tr>)}</tbody>
        </table></div> : <p>まだ入社手続きの入力はありません。</p>}
      </main>}
  </div>;
}
