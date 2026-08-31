import Link from "next/link";
import type { ReactNode } from "react";
import styles from "@/app/system/docs/docs.module.css";
import OrientationThemeToggle from "@/app/(orientation)/system/docs/company/present/OrientationThemeToggle";
import { findVisibleSlideDeck } from "@/app/system/docs/_data/slides";

export default async function SlideOrientationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ deck: string }>;
}) {
  const { deck } = await params;
  // 戻り先は承認済みデータのidからだけ作る。
  const known = findVisibleSlideDeck(deck);
  const backHref = known ? `/system/docs/slides/${known.id}` : "/system/docs/slides";
  return <main className={`${styles.pageShell} ${styles.presentationShell}`}>
    <div className={styles.presentationTools}>
      <OrientationThemeToggle />
      <Link className={styles.returnToDocument} href={backHref}>資料に戻る</Link>
    </div>
    {children}
  </main>;
}
