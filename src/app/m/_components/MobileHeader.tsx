"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { NoticeBell } from "@/app/_components/notices/NoticeBell";
import { useTheme } from "@/app/_lib/theme/ThemeProvider";
import { useAuthUnified } from "@/app/_lib/auth-unified";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
import { GARDEN_ROLE_LABELS } from "@/app/root/_constants/types";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { getMyEmployee } from "../_lib/mobile-expenses";
import { MobileIcon } from "./MobileIcon";
import styles from "../mobile.module.css";
export function MobileHeader() {
    const { theme, setTheme } = useTheme();
    const { role } = useAuthUnified();
    const [name, setName] = useState("ユーザー");
    const [open, setOpen] = useState(false);
    const wrap = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
    const id = useId();
    useEffect(() => { let live = true; void getMyEmployee(createBrowserClient()).then(employee => { if (live && employee)
        setName(employee.name || "ユーザー"); }); return () => { live = false; }; }, []);
    useEffect(() => { if (!open)
        return; const outside = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node))
        setOpen(false); }; const key = (e: KeyboardEvent) => { if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
    } }; document.addEventListener("pointerdown", outside); document.addEventListener("keydown", key); return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); }; }, [open]);
    async function logout() { await createBrowserClient().auth.signOut(); window.location.assign("/login"); }
    return <header className={styles.top}><Link href="/m" className={styles.brand}><Image src="/themes/garden-shell/images/login/mark-tree-emblem.png" width={36} height={40} alt="" unoptimized/>Garden</Link><div className={styles.actions}><NoticeBell /><div ref={wrap} className={styles.menuWrap} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget))
        setOpen(false); }}><button ref={trigger} className={styles.iconButton} type="button" aria-label="利用者メニュー" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><MobileIcon name="menu"/></button>{open && <div id={id} className={styles.menu} role="region" aria-label="利用者メニュー"><div className={styles.who} {...CLARITY_MASK}>{name}さん<small>{role ? GARDEN_ROLE_LABELS[role] : "未設定"}</small></div>{([['light', 'sun', '明るい表示'], ['dark', 'moon', '暗い表示']] as const).map(([value, icon, label]) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}><MobileIcon name={icon}/>{label}{theme === value && <MobileIcon name="check"/>}</button>)}<button type="button" onClick={() => void logout()}><MobileIcon name="logout"/>ログアウト</button></div>}</div></div></header>;
}
