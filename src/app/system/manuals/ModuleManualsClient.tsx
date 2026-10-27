"use client";
import { SystemViewHeading } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";

import DataTable, { type DataColumn } from "@/app/system/_components/DataTable/DataTable";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

    <ModuleManualsList module={module} manuals={manuals} />
  </div>;
}

const href = (manual: VisibleManual) => "/system/manuals/" + manual.moduleSlug + "/" + manual.slug;

export function ModuleManualsList({ module, manuals }: { module: ManualModule; manuals: VisibleManual[] }) {
  const router = useRouter();
  const columns: DataColumn<VisibleManual>[] = [
    { id: "name", label: "機能", type: "text", align: "text", value: manual => manual.name, render: manual => <span className={styles.nameWithIcon}><span className={styles.iconPlate}><MenuIcon icon={module.icon} /></span>{manual.name}</span> },
    { id: "description", label: "内容", type: "text", align: "text", wrap: true, value: manual => manual.description, render: manual => <span className={styles.descCell}>{manual.description}</span> },
    { id: "docs", label: "読める資料", type: "text", align: "text", wrap: true, value: manual => manual.visibleDocs.map(doc => doc.label).join(" / "), render: manual => <span className={styles.docsCell}>{manual.visibleDocs.map(doc => doc.label).join(" / ")}</span> },
    { id: "open", label: "表示", type: "text", align: "mark", value: () => "開く", render: manual => <Link href={href(manual)} onClick={event => event.stopPropagation()}>開く</Link> },
  ];
  return <div data-testid="manual-module-list"><DataTable key={module.slug} rows={manuals} columns={columns} rowKey={manual => manual.slug} onRowClick={manual => router.push(href(manual))} rowClickable={() => true} searchText={manual => manual.name + " " + manual.description} searchPlaceholder="機能・内容" defaultSort={{ id: "registry-order", direction: "asc" }} summary={rows => <span>マニュアル {rows.length} 件</span>} /></div>;
}
