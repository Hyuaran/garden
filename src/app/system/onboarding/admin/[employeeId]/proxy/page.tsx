import { redirect } from "next/navigation";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import OnboardingClient from "../../../OnboardingClient";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import { onboardingProxyContext, readProxyOnboarding } from "../../../_lib/onboarding-proxy.server";
import styles from "../../../onboarding.module.css";

export const metadata = { title: "入社手続き・代行入力 | Garden" };
export default async function ProxyPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  try {
    const context = await onboardingProxyContext(employeeId);
    const initial = await readProxyOnboarding(context);
    const name = initial.values.name || context.employee.name || "";
    // 代行入力の画面にも場所の表示と見出しを出す（無いと入力の枠が右上のボタンに重なったため 2026-10-26）
    return <main className={styles.pageShell} {...CLARITY_MASK}><header className={styles.header}><SystemBreadcrumb items={[{ label: "入社手続き", href: "/system/onboarding?tab=all" }, { label: name || "入社手続き", href: `/system/onboarding/admin/${encodeURIComponent(employeeId)}` }, { label: "代行入力" }]} /><h1>{name ? `${name}さんの入社手続き（代行入力）` : "入社手続き（代行入力）"}</h1></header><OnboardingClient initial={initial} proxy={{ employeeId,
      employeeName: initial.values.name || context.employee.name || "", actorName: context.actor.name, sensitive: context.sensitive }} /></main>;
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) redirect(`/login?returnTo=${encodeURIComponent(`/system/onboarding/admin/${employeeId}/proxy`)}`);
    return <main className={styles.panel}><p role="alert">{status ? (error as Error).message : "入社手続きを読み込めませんでした。"}</p></main>;
  }
}
