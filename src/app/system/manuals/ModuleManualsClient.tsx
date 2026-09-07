"use client";

import Link from "next/link";
import { MenuIcon } from "@/app/system/_components/ShachoShell/ShachoShell";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import type { ManualDefinition, ManualDoc, ManualModule } from "./_lib/manuals-registry";
import styles from "./manuals.module.css";

type VisibleManual = ManualDefinition & { visibleDocs: ManualDoc[] };

export default function ModuleManualsClient({ module, manuals }: { module: ManualModule; manuals: VisibleManual[] }) {
  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <div>
        <SystemBreadcrumb items={[{ label: "マニュアル", href: "/system/manuals" }, { label: module.name }]} />
        <h1>{module.name} のマニュアル</h1>
        <p className={styles.lead}>{module.description}</p>
      </div>
    </header>

    <div className={styles.tableWrap} data-testid="manual-module-list">
      <table>
        <thead><tr><th>機能</th><th>内容</th><th>読める資料</th><th></th></tr></thead>
        <tbody>
          {manuals.map((manual) => <tr key={manual.slug}>
            <td>
              <span className={styles.nameWithIcon}><span className={styles.iconPlate}><MenuIcon icon={module.icon} /></span>{manual.name}</span>
            </td>
            <td>{manual.description}</td>
            <td>{manual.visibleDocs.map((doc) => doc.label).join(" / ")}</td>
            <td><Link href={`/system/manuals/${manual.moduleSlug}/${manual.slug}`}>開く</Link></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}
