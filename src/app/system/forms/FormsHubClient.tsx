"use client";

import Link from "next/link";
import { useState } from "react";
import { MenuIcon } from "@/app/system/_components/ShachoShell/ShachoShell";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import type { SystemFormDefinition } from "./_lib/forms-registry";
import styles from "./forms.module.css";

const VIEW_MODE_KEY = "garden.forms.viewMode";
type ViewMode = "list" | "grid";

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
    // 保存できない環境でも、現在の画面では表示形式を切り替えられるようにする。
  }
}

export default function FormsHubClient({ forms }: { forms: SystemFormDefinition[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    storeViewMode(mode);
  }

  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <div>
        <SystemBreadcrumb items={[{ label: "フォーム" }]} />
        <h1>フォーム</h1>
        <p className={styles.lead}>月に一度の連絡や申請を、ここから開いて送ります。</p>
      </div>
    </header>

    <div className={styles.listHeading}>
      <h2>フォームの一覧</h2>
      <div className={styles.viewToggle} role="group" aria-label="表示形式">
        <button type="button" aria-label="リスト表示にする" aria-pressed={viewMode === "list"} onClick={() => changeViewMode("list")}><ListViewIcon /></button>
        <button type="button" aria-label="グリッド表示にする" aria-pressed={viewMode === "grid"} onClick={() => changeViewMode("grid")}><GridViewIcon /></button>
      </div>
    </div>

    {viewMode === "grid" ? (
      <section className={styles.formGrid} data-testid="forms-grid-view" aria-label="フォーム">
        {forms.map((form) => <article className={styles.formCard} key={form.slug}>
          <div className={styles.cardHeading}><span className={styles.iconPlate}><MenuIcon icon={form.icon} /></span><h2>{form.name}</h2></div>
          <p>{form.description}</p>
          <div className={styles.cardFooter}><span>権限：{form.roleLabel}</span><Link href={form.href}>開く</Link></div>
        </article>)}
      </section>
    ) : (
      <div className={styles.tableWrap} data-testid="forms-list-view">
        <table>
          <thead><tr><th>フォーム</th><th>内容</th><th>権限</th><th></th></tr></thead>
          <tbody>
            {forms.map((form) => <tr key={form.slug}>
              <td>{form.name}</td>
              <td>{form.description}</td>
              <td>{form.roleLabel}</td>
              <td><Link href={form.href}>開く</Link></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    )}
  </div>;
}
