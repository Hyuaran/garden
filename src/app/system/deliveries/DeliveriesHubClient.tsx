"use client";

import Link from "next/link";
import { useState } from "react";
import { MenuIcon } from "@/app/system/_components/ShachoShell/ShachoShell";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import type { SystemDeliveryDefinition } from "./_lib/deliveries-registry";
import styles from "./deliveries.module.css";

const VIEW_MODE_KEY = "garden.deliveries.viewMode";
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

export default function DeliveriesHubClient({ deliveries }: { deliveries: SystemDeliveryDefinition[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    storeViewMode(mode);
  }

  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <div>
        <SystemBreadcrumb items={[{ label: "自動配信" }]} />
        <h1>自動配信</h1>
        <p className={styles.lead}>決まった時刻に Chatwork へ自動で送っている連絡の一覧です。</p>
      </div>
    </header>

    <div className={styles.listHeading}>
      <h2>自動配信の一覧</h2>
      <div className={styles.viewToggle} role="group" aria-label="表示形式">
        <button type="button" aria-label="一覧表示にする" aria-pressed={viewMode === "list"} onClick={() => changeViewMode("list")}><ListViewIcon /></button>
        <button type="button" aria-label="カード表示にする" aria-pressed={viewMode === "grid"} onClick={() => changeViewMode("grid")}><GridViewIcon /></button>
      </div>
    </div>

    {viewMode === "grid" ? (
      <section className={styles.deliveryGrid} data-testid="deliveries-grid-view" aria-label="自動配信">
        {deliveries.map((delivery) => <article className={`${styles.deliveryCard} ${delivery.status === "upcoming" ? styles.muted : ""}`} key={delivery.slug}>
          <div className={styles.cardHeading}><span className={styles.iconPlate}><MenuIcon icon={delivery.icon} /></span><h2>{delivery.name}</h2></div>
          <p>{delivery.description}</p>
          <dl className={styles.cardDetails}>
            <div><dt>時刻</dt><dd>{delivery.schedule}</dd></div>
            <div><dt>送り先</dt><dd>{delivery.recipient}</dd></div>
            <div><dt>状態</dt><dd><span className={`${styles.statusBadge} ${styles[delivery.status]}`}>{delivery.statusLabel}</span></dd></div>
          </dl>
          <div className={styles.cardFooter}><Link href={delivery.href}>開く</Link></div>
        </article>)}
      </section>
    ) : (
      <div className={styles.tableWrap} data-testid="deliveries-list-view">
        <table>
          <thead><tr><th>配信</th><th>内容</th><th>時刻</th><th>送り先</th><th>状態</th><th></th></tr></thead>
          <tbody>
            {deliveries.map((delivery) => <tr className={delivery.status === "upcoming" ? styles.muted : ""} key={delivery.slug}>
              <td>{delivery.name}</td>
              <td>{delivery.description}</td>
              <td>{delivery.schedule}</td>
              <td>{delivery.recipient}</td>
              <td><span className={`${styles.statusBadge} ${styles[delivery.status]}`}>{delivery.statusLabel}</span></td>
              <td><Link href={delivery.href}>開く</Link></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    )}
  </div>;
}
