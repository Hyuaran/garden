import { canView, readViewPermissions, viewPermissionContext, ViewPermissionError } from "@/lib/auth/view-permission.server";
import { effectivePermission } from "@/lib/auth/view-permission";
import ViewPermissionButton from "@/app/system/_components/ViewPermissionButton/ViewPermissionButton";
import Link from "next/link";
import { redirect } from "next/navigation";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { OnboardingError, onboardingEmployee, readOnboarding } from "./_lib/onboarding.server";
import { onboardingAdminContext, readAdminOnboardingList } from "./_lib/onboarding-admin.server";
import { hireAdminContext } from "./_lib/hire-candidates.server";
import OnboardingClient from "./OnboardingClient";
import HireCandidatesClient from "./HireCandidatesClient";
import AdminOnboardingList from "./AdminOnboardingList";
import styles from "./onboarding.module.css";
export const metadata = { title: "入社手続き | Garden" };
export default async function OnboardingPage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<{ tab?: string | string[] }> }) {
  let context;
  try { context = await viewPermissionContext(); }
  catch (error) {
    if (error instanceof ViewPermissionError && error.status === 401) redirect("/login?returnTo=%2Fsystem%2Fonboarding");
    throw error;
  }
  const definitions = [{id:"self",label:"自分の入社手続き"},{id:"candidates",label:"入社予定者"},{id:"confirmations",label:"入社後の確認"},{id:"all",label:"みんなの入社手続き"}];
  const allowed = await Promise.all(definitions.map(item => canView("system-onboarding", item.id, context.viewer)));
  const tabs = definitions.filter((_, index) => allowed[index]);
  if (!tabs.length) return <section className={styles.panel}><h1>閲覧権限がありません</h1></section>;
  const requested = (await searchParams).tab;
  const tab = tabs.find(item => item.id === requested)?.id ?? tabs[0].id;
  const activeLabel = tabs.find(item => item.id === tab)!.label;
  const settings = await readViewPermissions();
  const canAdd = Boolean(effectivePermission(settings, "system-onboarding", tab)?.viewers_can_add);
  const adminContext = tab === "all" ? await onboardingAdminContext(true) : null;
  const hireContext = tab === "candidates" || tab === "confirmations" ? await hireAdminContext(tab) : null;
  let initial;
  let rows;
  let message = "";
  try {
    if (tab === "self") initial = await readOnboarding(await onboardingEmployee());
    if (tab === "all" && adminContext) rows = await readAdminOnboardingList(adminContext);
  } catch (error) {
    if (error instanceof OnboardingError && error.status === 401) redirect("/login?returnTo=%2Fsystem%2Fonboarding");
    message = error instanceof OnboardingError ? error.message : "入社手続きを読み込めませんでした。時間をおいて、もう一度お試しください。";
  }
  return <div className={styles.pageShell}>
    <header className={styles.header}><SystemBreadcrumb items={[{ label: "入社手続き" }]} /><h1>入社手続き</h1></header>
    <SystemTabs aria-label="入社手続き" actions={<ViewPermissionButton key={tab} pageKey="system-onboarding" tabKey={tab} tabLabel={activeLabel} admin={context.viewer.role === "super_admin"} canAdd={canAdd} />}>{tabs.map(item => <Link key={item.id} role="tab" aria-selected={tab === item.id} href={`/system/onboarding?tab=${item.id}`} scroll={false}>{item.label}</Link>)}</SystemTabs>
    {tab === "self" && (initial ? <OnboardingClient key={`${initial.status}-${initial.submittedAt ?? "draft"}`} initial={initial} />
      : <section className={styles.panel} role="status"><h2>入社手続きのご案内</h2><p>{message}</p></section>)}
    {(tab === "candidates" || tab === "confirmations") && hireContext && <HireCandidatesClient key={tab} userId={hireContext.userId} tab={tab} canWrite={context.viewer.role === "super_admin"} />}
    {tab === "all" && (rows ? <AdminOnboardingList rows={rows} /> : <section className={styles.panel} role="status"><h2>入社手続きの確認</h2><p>{message}</p></section>)}
  </div>;
}
