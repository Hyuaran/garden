"use client";
// Garden の右上の一式（名前・一覧／カード・お知らせ・文字の大きさ・明暗・ログアウト）と左上のロゴ。
// System の画面（ShachoShell）とマイページ（/my）で同じ部品を使い、見た目と印をそろえる。
import Image from "next/image";
import FontSizeButton from "@/app/system/_components/FontSizeButton";
import { HeaderViewSlot } from "@/app/system/_components/HeaderViewToggle";
import { NoticeBell } from "@/app/_components/notices/NoticeBell";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
import { useTheme } from "@/app/_lib/theme/ThemeProvider";
import styles from "@/app/system/_components/ShachoShell/shacho-shell.module.css";

export const GARDEN_MARK_SRC = "/themes/garden-shell/images/login/mark-tree-emblem.png";

export async function gardenLogout() {
  await createBrowserClient().auth.signOut();
  window.location.assign("/login");
}

/** 左上のロゴ（木の印＋Garden）。押しても他の画面へは行かない形（マイページ用） */
export function GardenBrandMark({ label = "Garden", mobile = false }: { label?: string; mobile?: boolean }) {
  return <span className={mobile ? styles.mobileBrand : styles.brandName}><Image className={mobile ? styles.mobileBrandMark : styles.brandMark} src={GARDEN_MARK_SRC} width={256} height={256} alt="" unoptimized /><span>{label}</span></span>;
}

export default function GardenHeaderActions({ name, mobile = false }: { name?: string; mobile?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const themeLabel = theme === "dark" ? "ライトにする" : "ダークにする";
  return <>
    {name && !mobile && <span className={styles.accountName} {...CLARITY_MASK}>{name}さん</span>}
    <HeaderViewSlot mobile={mobile} /><NoticeBell className={styles.iconButton} /><FontSizeButton className={styles.iconButton} tipClassName={styles.actionTip} />
    <button className={styles.iconButton} type="button" aria-label={mobile ? "テーマを切り替える" : themeLabel} onClick={toggleTheme}>{theme === "dark" ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9"/></svg> : <svg viewBox="0 0 24 24"><path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4z"/></svg>}<span className={styles.actionTip}>{themeLabel}</span></button>
    <button className={styles.iconButton} type="button" aria-label={mobile ? "ログアウトする" : "ログアウト"} onClick={() => void gardenLogout()}><svg viewBox="0 0 24 24"><path d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/></svg><span className={styles.actionTip}>ログアウト</span></button>
  </>;
}
