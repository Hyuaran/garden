"use client";

import Link from "next/link";
import { useState } from "react";
import { MenuIcon } from "@/app/system/_components/ShachoShell/ShachoShell";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import type { SystemFormDefinition } from "./_lib/forms-registry";
import type { GyomuTool, GyomuToolGroup } from "./_lib/gyomu-tools-registry";
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

type ToolCard = {
  key: string;
  name: string;
  description: string;
  meta: string;
  target?: string;
  href?: string;
  url?: string;
  details?: string[];
};

type ToolSection = {
  key: string;
  title: string;
  items: ToolCard[];
};

function metaText(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ／ ");
}

function formToCard(form: SystemFormDefinition): ToolCard {
  return {
    key: `form-${form.slug}`,
    name: form.name,
    description: form.description,
    meta: form.roleLabel,
    href: form.href,
  };
}

function toolToCard(tool: GyomuTool): ToolCard {
  return {
    key: `${tool.group}-${tool.name}`,
    name: tool.name,
    description: tool.description,
    meta: metaText([tool.schedule, tool.runsOn]),
    target: tool.target,
    href: tool.href,
    url: tool.url,
    details: tool.details,
  };
}

function groupedTools(forms: SystemFormDefinition[], tools: GyomuTool[]): ToolSection[] {
  const byGroup = (group: GyomuToolGroup) => tools.filter((tool) => tool.group === group).map(toolToCard);
  return [
    { key: "input", title: "入力する", items: forms.map(formToCard) },
    { key: "auto", title: "自動で動いている", items: byGroup("auto") },
    { key: "kintone", title: "Kintone に入れたしかけ", items: byGroup("kintone") },
  ].filter((section) => section.items.length > 0);
}

function OpenLink({ item }: { item: ToolCard }) {
  if (item.href) return <Link href={item.href}>開く →</Link>;
  if (item.url) return <a href={item.url} target="_blank" rel="noreferrer">開く →</a>;
  return null;
}

function ToolDetails({ details }: { details?: string[] }) {
  if (!details?.length) return null;
  return <details className={styles.details}><summary>詳細</summary><p>{details.join("・")}</p></details>;
}

export default function FormsHubClient({ forms, tools = [] }: { forms: SystemFormDefinition[]; tools?: GyomuTool[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const sections = groupedTools(forms, tools);

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    storeViewMode(mode);
  }

  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <div>
        <SystemBreadcrumb items={[{ label: "業務管理ツール" }]} />
        <h1>業務管理ツール</h1>
        <p className={styles.lead}>連絡や申請の入力、自動で動いている仕組み、Kintone に入れたしかけを 1 か所にまとめています。</p>
      </div>
    </header>

    <div className={styles.listHeading}>
      <h2>一覧</h2>
      <div className={styles.viewToggle} role="group" aria-label="表示形式">
        <button type="button" aria-label="リスト表示にする" aria-pressed={viewMode === "list"} onClick={() => changeViewMode("list")}><ListViewIcon /></button>
        <button type="button" aria-label="グリッド表示にする" aria-pressed={viewMode === "grid"} onClick={() => changeViewMode("grid")}><GridViewIcon /></button>
      </div>
    </div>

    {sections.map((section) => <section key={section.key} className={styles.toolSection}>
      <h2>{section.title}</h2>
      {viewMode === "grid" ? (
        <div className={styles.formGrid} data-testid={`${section.key}-grid-view`} aria-label={section.title}>
          {section.items.map((item) => <article className={styles.formCard} key={item.key}>
            <div className={styles.cardHeading}><span className={styles.iconPlate}><MenuIcon icon="document" /></span><h3>{item.name}</h3></div>
            <p>{item.description}</p>
            <ToolDetails details={item.details} />
            <div className={styles.cardFooter}><span>{item.meta}</span><OpenLink item={item} /></div>
          </article>)}
        </div>
      ) : (
        <div className={styles.tableWrap} data-testid={`${section.key}-list-view`}>
          <table>
            <thead><tr><th>名前</th><th>説明</th><th>いつ・どこで</th><th>対象</th><th></th></tr></thead>
            <tbody>
              {section.items.map((item) => <tr key={item.key}>
                <td>{item.name}</td>
                <td>{item.description}<ToolDetails details={item.details} /></td>
                <td>{item.meta}</td>
                <td>{item.target ?? ""}</td>
                <td><OpenLink item={item} /></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
    </section>)}
  </div>;
}
