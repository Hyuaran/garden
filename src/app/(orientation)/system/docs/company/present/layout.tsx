import Link from "next/link";
import type { ReactNode } from "react";
import styles from "@/app/system/docs/docs.module.css";
import OrientationThemeToggle from "./OrientationThemeToggle";

// /system/layout.tsx の子にしないことで、通常のShellには条件分岐を追加しない。
// 認証・在籍確認はpageのloadCompanyMembers内で、本文と写真を返す前に行う。
export default function OrientationLayout({ children }: { children: ReactNode }) {
  return <main className={`${styles.pageShell} ${styles.presentationShell}`}>
    <div className={styles.presentationTools}>
      <OrientationThemeToggle />
      <Link className={styles.returnToDocument} href="/system/docs/company">資料に戻る</Link>
    </div>
    {children}
  </main>;
}
