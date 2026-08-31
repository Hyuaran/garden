import { redirect } from "next/navigation";
import { OnboardingError, onboardingEmployee, readOnboarding } from "./_lib/onboarding.server";
import OnboardingClient from "./OnboardingClient";
import styles from "./onboarding.module.css";

export const metadata = { title: "入社手続き | Garden" };

export default async function OnboardingPage() {
  let initial;
  let message = "";
  try {
    const context = await onboardingEmployee();
    initial = await readOnboarding(context);
  } catch (error) {
    if (error instanceof OnboardingError && error.status === 401) redirect("/login?returnTo=%2Fsystem%2Fonboarding");
    message = error instanceof OnboardingError ? error.message : "入社手続きを読み込めませんでした。時間をおいて、もう一度お試しください。";
  }
  return <div className={styles.pageShell}>
    <header className={styles.header}><p className={styles.eyebrow}>System ／ 入社手続き</p><h1>入社手続き</h1></header>
    {initial ? <OnboardingClient key={`${initial.status}-${initial.submittedAt ?? "draft"}`} initial={initial} />
      : <section className={styles.panel} role="status"><h2>入社手続きのご案内</h2><p>{message}</p></section>}
  </div>;
}
