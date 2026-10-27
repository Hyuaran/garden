"use client";
import Link from "next/link";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { SystemViewButton } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { ModuleManualsList } from "./ModuleManualsClient";
import type { ManualDefinition, ManualDoc, ManualModule } from "./_lib/manuals-registry";
import styles from "./manuals.module.css";

export default function ManualsHubClient({ modules, manuals = [], conceptHtml = "", selectedTab }: {
  modules: (ManualModule & { count: number })[];
  manuals?: (ManualDefinition & { visibleDocs: ManualDoc[] })[];
  conceptHtml?: string;
  selectedTab?: string;
}) {
  const tabs = [...(conceptHtml ? [{ slug: "concept", name: "Garden とは" }] : []), ...modules];
  const active = tabs.some(tab => tab.slug === selectedTab) ? selectedTab : tabs[0]?.slug;
  const module = modules.find(module => module.slug === active);
  return <div className={styles.pageShell}>
    <header className={styles.header}><div>
      <SystemBreadcrumb items={[{ label: "マニュアル" }]} />
      <h1>マニュアル</h1>
    </div></header>
    <SystemTabs actions={<SystemViewButton />} aria-label="マニュアルタブ">
      {tabs.map(tab => <Link key={tab.slug} role="tab" aria-selected={active === tab.slug} aria-current={active === tab.slug ? "page" : undefined} href={"/system/manuals?tab=" + tab.slug}>{tab.name}</Link>)}
    </SystemTabs>
    {active === "concept" ? <section className={styles.conceptBody} aria-label="Garden とは" dangerouslySetInnerHTML={{ __html: conceptHtml }} />
      : module ? <ModuleManualsList module={module} manuals={manuals.filter(manual => manual.moduleSlug === module.slug)} /> : null}
  </div>;
}
