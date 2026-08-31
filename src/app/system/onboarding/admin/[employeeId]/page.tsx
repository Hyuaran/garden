import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingError } from "../../_lib/onboarding.server";
import { onboardingAdminContext, readAdminOnboardingDetail } from "../../_lib/onboarding-admin.server";
import OnboardingAdminDetailClient from "./OnboardingAdminDetailClient";
import styles from "../../onboarding.module.css";

export const metadata = { title: "入社手続き（事務） | Garden" };

export default async function OnboardingAdminDetailPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  let record = null;
  let message = "";
  try {
    const context = await onboardingAdminContext();
    record = await readAdminOnboardingDetail(context, employeeId);
    if (!record) message = "入社手続きの入力が見つかりませんでした。";
  } catch (error) {
    if (error instanceof OnboardingError && error.status === 401) redirect(`/login?returnTo=${encodeURIComponent(`/system/onboarding/admin/${employeeId}`)}`);
    message = error instanceof OnboardingError ? error.message : "入社手続きを読み込めませんでした。時間をおいて、もう一度お試しください。";
  }
  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>System ／ 入社手続き（事務）</p>
      <h1>{record?.values.name || record?.employee.name || "入社手続き"}</h1>
      <Link href="/system/onboarding/admin">一覧へ戻る</Link>
    </header>
    {message === "閲覧権限がありません" ? <main className={styles.panel}><h2>閲覧権限がありません</h2><p>この画面は責任者以上が利用できます。</p></main>
      : message ? <main className={styles.panel} role="status"><h2>入社手続きの確認</h2><p>{message}</p></main>
      : record ? <main><OnboardingAdminDetailClient record={record} /></main> : null}
  </div>;
}
