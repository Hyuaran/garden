"use client";
import { SystemViewHeading } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";

import StickyTable from "@/app/system/_components/StickyTable/useStickyTable";
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
        <SystemViewHeading><h1>{module.name} のマニュアル</h1></SystemViewHeading>
      </div>
    </header>

    <div className={styles.tableWrap} data-testid="manual-module-list">
      <StickyTable>
        <thead><tr><th>機能</th><th>内容</th><th>読める資料</th><th></th></tr></thead>
        <tbody>
          {manuals.map((manual) => <tr key={manual.slug}>
            <td className="garden-cell-text">
              <span className={styles.nameWithIcon}><span className={styles.iconPlate}><MenuIcon icon={module.icon} /></span>{manual.name}</span>
            </td>
            <td className="garden-cell-text">{manual.description}</td>
            <td className="garden-cell-text">{manual.visibleDocs.map((doc) => doc.label).join(" / ")}</td>
            <td className="garden-cell-text"><Link href={`/system/manuals/${manual.moduleSlug}/${manual.slug}`}>開く</Link></td>
          </tr>)}
        </tbody>
      </StickyTable>
    </div>
  </div>;
}
