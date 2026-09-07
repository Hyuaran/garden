"use client";

import Link from "next/link";
import { useState } from "react";
import { MenuIcon } from "@/app/system/_components/ShachoShell/ShachoShell";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import type { ManualModule } from "./_lib/manuals-registry";
import styles from "./manuals.module.css";

const VIEW_MODE_KEY = "garden.manuals.viewMode";
type ViewMode = "list" | "grid";
type ManualModuleWithCount = ManualModule & { count: number };

function ListViewIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><rect x="4" y="5" width="2" height="2" rx=".5"/><rect x="4" y="11" width="2" height="2" rx=".5"/><rect x="4" y="17" width="2" height="2" rx=".5"/></svg>;
}

function GridViewIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.2"/><rect x="14" y="4" width="6" height="6" rx="1.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><rect x="14" y="14" width="6" height="6" rx="1.2"/></svg>;
}

function readViewMode(): ViewMode {
  try {
    if (typeof window === "undefined") return "list";
    return window.localStorage.getItem(VIEW_MODE_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

function storeViewMode(mode: ViewMode) {
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // Storage is optional; the visible page state still changes.
  }
}

export default function ManualsHubClient({ modules }: { modules: ManualModuleWithCount[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    storeViewMode(mode);
  }

  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <div>
        <SystemBreadcrumb items={[{ label: "マニュアル" }]} />
        <h1>マニュアル</h1>
        <p className={styles.lead}>Garden の使い方と仕組みの資料です。</p>
      </div>
    </header>

    <div className={styles.listHeading}>
      <h2>モジュール</h2>
      <div className={styles.viewToggle} role="group" aria-label="表示形式">
        <button type="button" aria-label="一覧表示にする" aria-pressed={viewMode === "list"} onClick={() => changeViewMode("list")}><ListViewIcon /></button>
        <button type="button" aria-label="カード表示にする" aria-pressed={viewMode === "grid"} onClick={() => changeViewMode("grid")}><GridViewIcon /></button>
      </div>
    </div>

    {viewMode === "grid" ? (
      <section className={styles.manualGrid} data-testid="manuals-grid-view" aria-label="マニュアル">
        {modules.map((module) => <article className={styles.manualCard} key={module.slug}>
          <div className={styles.cardHeading}><span className={styles.iconPlate}><MenuIcon icon={module.icon} /></span><h2>{module.name}</h2></div>
          <p>{module.description}</p>
          <div className={styles.cardFooter}><span>マニュアル {module.count} 件</span><Link href={`/system/manuals/${module.slug}`}>開く</Link></div>
        </article>)}
      </section>
    ) : (
      <div className={styles.tableWrap} data-testid="manuals-list-view">
        <table>
          <thead><tr><th>モジュール</th><th>内容</th><th>件数</th><th></th></tr></thead>
          <tbody>
            {modules.map((module) => <tr key={module.slug}>
              <td>{module.name}</td>
              <td>{module.description}</td>
              <td>{module.count}</td>
              <td><Link href={`/system/manuals/${module.slug}`}>開く</Link></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    )}
  </div>;
}
