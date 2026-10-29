"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { useTheme } from "@/app/_lib/theme/ThemeProvider";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
import { MobileIcon } from "@/app/m/_components/MobileIcon";
import styles from "./my.module.css";
import { MY_TABS, type MyTab } from "./tabs";
export default function MyShell({tab,name,children}: {tab: MyTab;name:string;children:ReactNode}) {
 const {theme,setTheme}=useTheme();
 async function logout(){await createBrowserClient().auth.signOut();window.location.assign("/login");}
 return <div className={styles.shell}><header className={styles.top}><strong>Garden</strong><div className={styles.actions}><span data-clarity-mask="true">{name} さん</span><button type="button" aria-label="明暗の切り替え" onClick={()=>setTheme(theme==="dark"?"light":"dark")}><MobileIcon name={theme==="dark"?"sun":"moon"}/></button><button type="button" aria-label="ログアウト" onClick={()=>void logout()}><MobileIcon name="logout"/></button></div></header>
 <main className={styles.main}><h1>{MY_TABS.find(item=>item.id===tab)!.label}</h1><div className={styles.desktop}><SystemTabs aria-label="マイページ">{MY_TABS.map(item=><Link key={item.id} href={"/my?tab="+item.id} role="tab" aria-selected={tab===item.id}>{item.label}</Link>)}</SystemTabs></div><div key={tab}>{children}</div></main>
 <nav className={styles.bottom} aria-label="マイページ">{MY_TABS.map(item=><Link key={item.id} href={"/my?tab="+item.id} aria-current={tab===item.id?"page":undefined}>{item.icon==="phone"?<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 3h5l2 5-3 2c1 3 3 5 6 6l2-3 5 2v5c-9 2-19-8-17-17Z"/></svg>:<MobileIcon name={item.icon}/>}<span>{item.short}</span></Link>)}</nav></div>;
}
