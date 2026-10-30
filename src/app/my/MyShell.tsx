"use client";
import { PageSearchProvider, PageSearchActions } from "@/app/system/_components/PageSearchSlot/PageSearchSlot";

import Link from "next/link";
import QuarterlyConfirm from "./QuarterlyConfirm";
import MyNumberPrompt from "./MyNumberPrompt";
import { useState, type ReactNode, type MouseEvent } from "react";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { HeaderViewProvider } from "@/app/system/_components/HeaderViewToggle";
import GardenHeaderActions, { GardenBrandMark } from "@/app/system/_components/GardenHeaderActions/GardenHeaderActions";
import { MobileIcon } from "@/app/m/_components/MobileIcon";
import styles from "./my.module.css";
import { MY_TABS, type MyTab } from "./tabs";
export default function MyShell({tab,name,children,hideHeading=false}: {tab: MyTab;name:string;children:ReactNode;hideHeading?:boolean}) {
 const [locked,setLocked]=useState(true);
 function guard(event: MouseEvent<HTMLAnchorElement>) {if(locked){event.preventDefault();window.alert("先に登録内容の確認をお願いします");}}
 return <HeaderViewProvider><PageSearchProvider><div className={styles.shell}><header className={styles.top}><GardenBrandMark /><div className={styles.actions}><span className={styles.desktopOnly}><PageSearchActions><GardenHeaderActions name={name} /></PageSearchActions></span><span className={styles.mobileOnly}><GardenHeaderActions mobile /></span></div></header>
 <QuarterlyConfirm onLock={setLocked}/><main className={styles.main}>{!hideHeading && <h1>{MY_TABS.find(item=>item.id===tab)!.label}</h1>}<div className={styles.desktop}><SystemTabs aria-label="マイページ">{MY_TABS.map(item=><Link key={item.id} onClick={guard} href={"/my?tab="+item.id} role="tab" aria-selected={tab===item.id}>{item.label}</Link>)}</SystemTabs></div><MyNumberPrompt locked={locked} profile={tab==='profile'}/><div key={tab}>{children}</div></main>
 <nav className={styles.bottom} aria-label="マイページ">{MY_TABS.map(item=><Link key={item.id} onClick={guard} href={"/my?tab="+item.id} aria-current={tab===item.id?"page":undefined}>{item.icon==="phone"?<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 3h5l2 5-3 2c1 3 3 5 6 6l2-3 5 2v5c-9 2-19-8-17-17Z"/></svg>:<MobileIcon name={item.icon}/>}<span>{item.short}</span></Link>)}</nav></div></PageSearchProvider></HeaderViewProvider>;
}
