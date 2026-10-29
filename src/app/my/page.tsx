import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import { needsOnboarding } from "@/app/system/onboarding/_lib/onboarding.server";
import MyPageSectionPage from "@/app/system/mypage/_components/MyPageSectionPage";
import InnoveraCallsContent from "@/app/system/innovera-calls/InnoveraCallsContent";
import { type MyPageTab } from "@/app/system/mypage/types";
import MyShell from "./MyShell";
import { resolveMyTab } from "./tabs";
import styles from "./my.module.css";
const ONBOARDING_START = "2026-10-25";
export const metadata = { title: "マイページ | Garden" };
export default async function MyPage({searchParams}: {searchParams: Promise<{tab?: string | string[]}>}) {
 const query = await searchParams;
 const tab = resolveMyTab(query.tab);
 const returnTo = typeof query.tab === "string" ? "/my?tab=" + encodeURIComponent(query.tab) : "/my";
 const supabase = await createServerClient();
 const {data: auth} = await supabase.auth.getUser();
 if (!auth.user) redirect("/login?returnTo=" + encodeURIComponent(returnTo));
 const {data: employee} = await supabase.from("root_employees").select("employee_id,name,hire_date,is_active,termination_date,deleted_at").eq("user_id",auth.user.id).eq("is_active",true).is("deleted_at",null).maybeSingle();
 if (!employee || !isEmployeeActive(employee)) redirect("/login?returnTo=" + encodeURIComponent(returnTo));
 // 入社手続きの仕組みを始めた 2026-10-25 以降に入社した人で、まだ終わっていない人だけに出す（前からいる人には出さない）
 const newHire = typeof employee.hire_date === "string" && employee.hire_date >= ONBOARDING_START;
 const pending = tab === "profile" && newHire && await needsOnboarding(supabase,String(employee.employee_id));
 return <MyShell tab={tab} name={String(employee.name ?? "")}>
 {pending && <section className={styles.card}><Link href="/system/onboarding?tab=self">入社手続きを進めてください</Link></section>}
 {tab === "report" ? <section className={styles.card}><h2>準備中</h2><p>AP日報をここから送れるようになります</p></section> : tab === "calls" ? <InnoveraCallsContent embedded /> : <MyPageSectionPage section={tab as MyPageTab} embedded />}
 </MyShell>;
}
