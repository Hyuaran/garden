"use client";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { useUrlTab } from "@/app/system/_components/SystemTabs/useUrlTab";
import { SystemViewHeading, SystemViewButton, useSystemView } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { BudGate } from "../_components/BudGate";
import { BudShell } from "../_components/BudShell";
import StatementsContent from "./StatementsContent";
import SummaryContent from "./summary/StatementsSummaryContent";
import ImportsContent from "./imports/StatementsImportsContent";
const definitions = [{ key: "list", label: "明細一覧" }, { key: "summary", label: "月次集計" }, { key: "imports", label: "取込履歴" }];
export default function StatementsTabs() {
  const { allowedTab } = useSystemView();
  const tabs = definitions.filter(tab => allowedTab(tab.key));
  const [requested, select] = useUrlTab(tabs[0]?.key ?? "list", key => tabs.some(tab => tab.key === key));
  const active = tabs.some(tab => tab.key === requested) ? requested : tabs[0]?.key;
  return <BudGate><BudShell><div data-bud-managed-tabs className="p-6 max-w-7xl mx-auto">
    <SystemBreadcrumb root={{ label: "Bud", href: "/bud/dashboard" }} items={[{ label: "明細" }]} />
    <SystemViewHeading showActions={tabs.length <= 1} actions={<SystemViewButton tabKey={active} />}><h1 style={{ fontSize: 30 }}>明細</h1></SystemViewHeading>
    <SystemTabs aria-label="明細" actions={<SystemViewButton tabKey={active} />}>{tabs.map(tab => <button key={tab.key} type="button" role="tab" aria-selected={tab.key === active} onClick={() => select(tab.key)}>{tab.label}</button>)}</SystemTabs>
    {active === "list" && <StatementsContent />}
    {active === "summary" && <SummaryContent />}
    {active === "imports" && <ImportsContent />}
  </div></BudShell></BudGate>;
}
