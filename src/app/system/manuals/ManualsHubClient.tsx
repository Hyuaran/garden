"use client";
import { SystemViewHeading } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import Link from "next/link";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { SystemViewButton } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { ModuleManualsList } from "./ModuleManualsClient";
import { MANUAL_MODULES, type ManualDefinition, type ManualDoc, type ManualModule } from "./_lib/manuals-registry";
import { GARDEN_SHELL_MODULES, type GardenModuleId } from "@/app/_components/layout/GardenShell/garden-shell-config";
import { ModuleIcon } from "@/app/_components/ModuleIcon/ModuleIcon";
import styles from "./manuals.module.css";

export default function ManualsHubClient({ modules, manuals = [], conceptHtml = "", selectedTab }: {
  modules: (ManualModule & { count: number })[];
  manuals?: (ManualDefinition & { visibleDocs: ManualDoc[] })[];
  conceptHtml?: string;
  selectedTab?: string;
}) {
  const moduleTabs = [{ id: "system", name: "System" }, ...GARDEN_SHELL_MODULES]
    .filter(tab => !MANUAL_MODULES.some(module => module.slug === tab.id) || modules.some(module => module.slug === tab.id))
    .map(tab => ({ slug: tab.id, name: tab.name, disabled: !MANUAL_MODULES.some(module => module.slug === tab.id) }));
  const tabs = [...(conceptHtml ? [{ slug: "concept", name: "Garden とは", disabled: false }] : []), ...moduleTabs];
  const active = tabs.some(tab => tab.slug === selectedTab && !tab.disabled) ? selectedTab : tabs.find(tab => !tab.disabled)?.slug;
  const module = modules.find(module => module.slug === active);
  return <div className={styles.pageShell}>
    <header className={styles.header}><div>
      <SystemBreadcrumb items={[{ label: "マニュアル" }]} />
      <SystemViewHeading showActions={tabs.length <= 1} actions={<SystemViewButton />}><h1>マニュアル</h1></SystemViewHeading>
    </div></header>
    <SystemTabs variant="icons" actions={<SystemViewButton />} aria-label="マニュアルタブ">
      {tabs.map(tab => {
        const content = <><ManualTabIcon slug={tab.slug} /><small>{tab.name}</small></>;
        return tab.disabled
          ? <button key={tab.slug} type="button" role="tab" aria-selected={false} disabled title="まだマニュアルがありません">{content}</button>
          : <Link key={tab.slug} role="tab" aria-selected={active === tab.slug} aria-current={active === tab.slug ? "page" : undefined} href={"/system/manuals?tab=" + tab.slug}>{content}</Link>;
      })}
    </SystemTabs>
    {active === "concept" ? <section className={styles.conceptBody} aria-label="Garden とは" dangerouslySetInnerHTML={{ __html: conceptHtml }} />
      : module ? <ModuleManualsList module={module} manuals={manuals.filter(manual => manual.moduleSlug === module.slug)} /> : null}
  </div>;
}

function ManualTabIcon({ slug }: { slug: string }) {
  if (slug !== "concept" && slug !== "system") return <ModuleIcon id={slug as GardenModuleId} />;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    {slug === "system" ? <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9h18M9 9v12" /></>
      : <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 5v15M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z" />}
  </svg>;
}
