"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
import AttendanceTab from "./tabs/AttendanceTab";
import ProfileTab from "./tabs/ProfileTab";
import ShiftTab from "./tabs/ShiftTab";
import ZenkakuTab from "./tabs/ZenkakuTab";
import type { MyPageProfile, MyPageTab } from "./types";
import type { PostalDatasetStatus } from "./_lib/postal-data";
import styles from "./mypage.module.css";

const TABS: Array<{ id: MyPageTab; label: string }> = [
  { id: "profile", label: "マイページ" }, { id: "attendance", label: "勤怠打刻" },
  { id: "shift", label: "シフト" }, { id: "zenkaku", label: "前確依頼" },
];

export default function MyPageClient({ initialTab, registered, employeeName, canViewSync, birthdayRegistered, initialProfile, postalDataStatus }: {
  initialTab: MyPageTab;
  registered: boolean;
  employeeName: string | null;
  canViewSync: boolean;
  birthdayRegistered: boolean;
  initialProfile: MyPageProfile | null;
  postalDataStatus?: PostalDatasetStatus | null;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<MyPageTab>(initialTab);
  const [profile, setProfile] = useState<MyPageProfile | null>(initialProfile);
  function selectTab(tab: MyPageTab) {
    setActiveTab(tab);
    router.replace(tab === "profile" ? "/system/mypage" : `/system/mypage?tab=${tab}`, { scroll: false });
  }
  async function logout() {
    await createBrowserClient().auth.signOut();
    router.replace("/login?returnTo=%2Fsystem%2Fmypage");
    router.refresh();
  }
  return <div className={styles.pageShell}><main className={styles.main}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Garden employee portal</p><h1>マイページ</h1></div>
      <button type="button" className={styles.logout} onClick={() => void logout()}>ログアウト</button></header>
    <div className={styles.tabs} role="tablist" aria-label="マイページメニュー">
      {TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id}
        onClick={() => selectTab(tab.id)}>{tab.label}</button>)}
    </div>
    <div role="tabpanel" className={styles.tabPanel}>
      {activeTab === "profile" && <ProfileTab registered={registered} birthdayRegistered={birthdayRegistered} profile={profile} onUnlocked={setProfile} />}
      {activeTab === "attendance" && <AttendanceTab registered={registered} employeeName={employeeName} canViewSync={canViewSync} />}
      {activeTab === "shift" && <ShiftTab />}
      {activeTab === "zenkaku" && <ZenkakuTab postalDataStatus={postalDataStatus} />}
    </div>
  </main></div>;
}
