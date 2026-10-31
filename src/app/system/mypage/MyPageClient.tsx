"use client";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { SystemViewHeading } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";

import { useEffect, useState } from "react";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import AttendanceTab from "./tabs/AttendanceTab";
import ProfileTab from "./tabs/ProfileTab";
import ShiftTab from "./tabs/ShiftTab";
import ZenkakuTab from "./tabs/ZenkakuTab";
import { MY_PAGE_TITLES, type MyPageProfile, type MyPageTab } from "./types";
import type { PostalDatasetStatus } from "./_lib/postal-data";
import styles from "./mypage.module.css";

export default function MyPageClient({ initialTab, embedded = false, registered, employeeName, canViewSync, needsExtension = false, birthdayRegistered, initialProfile, postalDataStatus }: {
  initialTab: MyPageTab;
  embedded?: boolean;
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
  const title = MY_PAGE_TITLES[activeTab];
  return <div className={styles.pageContent}>
    {!embedded && <><header className={styles.header}><SystemBreadcrumb items={[{ label: title }]} /><SystemViewHeading><h1>{title}</h1></SystemViewHeading>{activeTab === "profile" && <EmployeeLink />}</header><SystemTabs /></>}
    <div className={styles.standalonePanel}>
      {activeTab === "profile" && <ProfileTab registered={registered} birthdayRegistered={birthdayRegistered} profile={profile} onUnlocked={setProfile} />}
      {activeTab === "attendance" && <AttendanceTab registered={registered} employeeName={employeeName} canViewSync={canViewSync} needsExtension={needsExtension} />}
      {activeTab === "shift" && <ShiftTab embedded={embedded} />}
      {activeTab === "zenkaku" && <ZenkakuTab embedded={embedded} postalDataStatus={postalDataStatus} />}
    </div>
  </div>;
}

// 従業員に渡すマイページの入口（/my＝メニューなし）。System の中の自分の情報にだけ出す
function EmployeeLink() {
  const [url, setUrl] = useState("/my");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setUrl(`${window.location.origin}/my`); }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }
  return <p className={styles.employeeLink}>
    <span>従業員用リンク</span>
    <a href="/my" target="_blank" rel="noopener">{url}</a>
    <button type="button" onClick={() => void copy()}>{copied ? "コピーしました" : "コピー"}</button>
  </p>;
}
