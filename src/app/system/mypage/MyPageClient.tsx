"use client";

import { useState } from "react";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import AttendanceTab from "./tabs/AttendanceTab";
import ProfileTab from "./tabs/ProfileTab";
import ShiftTab from "./tabs/ShiftTab";
import ZenkakuTab from "./tabs/ZenkakuTab";
import { MY_PAGE_TITLES, type MyPageProfile, type MyPageTab } from "./types";
import type { PostalDatasetStatus } from "./_lib/postal-data";
import styles from "./mypage.module.css";

export default function MyPageClient({ initialTab, registered, employeeName, canViewSync, needsExtension = false, birthdayRegistered, initialProfile, postalDataStatus }: {
  initialTab: MyPageTab;
  tabbed?: boolean;
  registered: boolean;
  employeeName: string | null;
  canViewSync: boolean;
  needsExtension?: boolean;
  birthdayRegistered: boolean;
  initialProfile: MyPageProfile | null;
  postalDataStatus?: PostalDatasetStatus | null;
}) {
  const activeTab = initialTab;
  const [profile, setProfile] = useState<MyPageProfile | null>(initialProfile);
  const title = activeTab === "profile" ? "マイページ" : MY_PAGE_TITLES[activeTab];
  return <div className={styles.pageContent}>
    <header className={styles.header}><SystemBreadcrumb items={[{ label: title }]} /><h1>{title}</h1></header>
    <div className={styles.standalonePanel}>
      {activeTab === "profile" && <ProfileTab registered={registered} birthdayRegistered={birthdayRegistered} profile={profile} onUnlocked={setProfile} />}
      {activeTab === "attendance" && <AttendanceTab registered={registered} employeeName={employeeName} canViewSync={canViewSync} needsExtension={needsExtension} />}
      {activeTab === "shift" && <ShiftTab />}
      {activeTab === "zenkaku" && <ZenkakuTab postalDataStatus={postalDataStatus} />}
    </div>
  </div>;
}
