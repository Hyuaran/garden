"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import UpdatedStamp from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import ViewPermissionButton from "@/app/system/_components/ViewPermissionButton/ViewPermissionButton";
import DataTable, {
  type DataColumn,
} from "@/app/system/_components/DataTable/DataTable";
import BoxSelect from "@/app/system/_components/BoxSelect/BoxSelect";
import { ActionButton } from "@/app/system/forms/_components/form-kit";
import { ledgerNotices } from "@/lib/haken/ledger";
import { todayJst } from "@/lib/haken/rules";
import type { HakenData, HakenWorker, HakenParty } from "@/lib/haken/types";
import styles from "./haken.module.css";
import ExcelButton from "./ExcelButton";

export default function HakenClient({
  initialData,
  canWrite,
  admin,
  initialTab,
}: {
  initialData: HakenData;
  canWrite: boolean;
  admin: boolean;
  initialTab: string;
}) {
  const [data, setData] = useState(initialData);
  const [checkedAt, setCheckedAt] = useState<string>();
  const [refreshBusy, setRefreshBusy] = useState(false);
  const refreshing = useRef(false);
  async function refresh() {
    if (refreshing.current) return;
    refreshing.current = true;
    setRefreshBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/system/haken", { cache: "no-store" });
      if (!response.ok) throw new Error("派遣管理を読み直せませんでした");
      setData(await response.json() as HakenData);
      setCheckedAt(new Date().toISOString());
    } catch {
      setMessage("派遣管理を読み直せませんでした。もう一度お試しください。");
    } finally {
      refreshing.current = false;
      setRefreshBusy(false);
    }
  }
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const [partyIds, setPartyIds] = useState([""]);
  const [state, setState] = useState([""]);
  const [message, setMessage] = useState("");
  const today = todayJst();
  const contract = (worker: HakenWorker) =>
    data.contracts.find((c) => c.id === worker.contract_id)!;
  const partyName = (worker: HakenWorker) =>
    data.parties.find((p) => p.id === contract(worker)?.party_id)?.name ?? "";
  const status = (worker: HakenWorker) =>
    contract(worker).period_end && contract(worker).period_end! < today
      ? "終了"
      : contract(worker).period_start > today
        ? "開始前"
        : "受入中";
  const collected = (worker: HakenWorker) =>
    data.documents.some(
      (d) =>
        d.contract_id === worker.contract_id &&
        d.doc_type === "individual" &&
        d.drive_url &&
        !d.save_error,
    )
      ? "回収済み"
      : "未回収";
  const rows = data.workers
    .filter(
      (w) =>
        !w.deleted_at && data.contracts.some((c) => c.id === w.contract_id),
    )
    .filter(
      (w) =>
        (!partyIds[0] || partyIds.includes(contract(w).party_id)) &&
        (!state[0] || state.includes(status(w))),
    );
  const columns: DataColumn<HakenWorker>[] = [
    { id: "name", label: "氏名", type: "text", value: (w) => w.name },
    { id: "party", label: "派遣会社", type: "text", value: partyName },
    {
      id: "org",
      label: "部署",
      type: "text",
      value: (w) => contract(w).org_unit,
    },
    {
      id: "start",
      label: "開始日",
      type: "date",
      value: (w) => contract(w).period_start,
    },
    {
      id: "end",
      label: "終了日",
      type: "date",
      value: (w) => contract(w).period_end ?? "",
    },
    { id: "document", label: "個別契約書", type: "text", value: collected },
    { id: "status", label: "状態", type: "text", value: status },
  ];
  const partyColumns: DataColumn<HakenParty>[] = [
    { id: "name", label: "会社名", type: "text", value: (p) => p.name },
    {
      id: "office",
      label: "事業所",
      type: "text",
      value: (p) => p.office_name,
    },
    {
      id: "manager",
      label: "派遣元責任者",
      type: "text",
      value: (p) => p.manager_name,
    },
    {
      id: "delivery",
      label: "請求書の届き方",
      type: "text",
      value: (p) =>
        p.invoice_delivery === "mail" ? "メールで届く" : "自分で見に行く",
    },
  ];
  const notices = ledgerNotices(data);
  return (
    <main className={styles.page}>
      <SystemBreadcrumb items={[{ label: "派遣管理" }]} />
      <div className={styles.heading}>
        <h1>派遣管理</h1>
        <UpdatedStamp
          label=""
          onRefresh={() => void refresh()}
          busy={refreshBusy}
          refreshLabel="派遣管理を読み直す"
          showSeconds
          date={checkedAt ?? [...data.contracts, ...data.parties]
            .map((c) => c.updated_at)
            .sort()
            .at(-1)}
        />
      </div>
      <SystemTabs
        actions={
          <ViewPermissionButton
            pageKey="system-haken"
            tabKey=""
            tabLabel="派遣管理"
            admin={admin}
          />
        }
      >
        {[
          ["workers", "受け入れた人"],
          ["parties", "派遣会社"],
          ["deadlines", "期限と未回収"],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key);
              router.replace(`/system/haken?tab=${key}`, { scroll: false });
            }}
          >
            {label}
          </button>
        ))}
      </SystemTabs>
      {message && (
        <p role="alert" className={styles.error}>
          {message}
        </p>
      )}
      {tab === "workers" && (
        <>
          <div className={styles.tools}>
            <BoxSelect
              label="派遣会社"
              value={partyIds}
              multiple={false}
              onChange={setPartyIds}
              options={[
                { value: "", label: "すべて" },
                ...data.parties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <BoxSelect
              label="状態"
              value={state}
              multiple={false}
              onChange={setState}
              options={["すべて", "受入中", "開始前", "終了"].map(
                (label, i) => ({ value: i ? label : "", label }),
              )}
            />
            {canWrite && (
              <ActionButton onClick={() => router.push("/system/haken/ukeire/new")}>
                追加する
              </ActionButton>
            )}
          </div>
          <DataTable
            rows={rows}
            summary={(filtered) => (
              <ExcelButton
                ids={filtered.map((w) => w.id)}
                onError={setMessage}
              />
            )}
            columns={columns}
            rowKey={(w) => w.id}
            searchText={(w) =>
              [w.name, partyName(w), contract(w).org_unit].join(" ")
            }
            defaultSort={{ id: "start", direction: "desc" }}
            onRowClick={(w) => router.push(`/system/haken/ukeire/${w.id}`)}
          />
        </>
      )}
      {tab === "parties" && (
        <>
          <div className={styles.tools}>
            {canWrite && (
              <>
                <ActionButton
                  onClick={() => router.push("/system/haken/parties/new")}
                >
                  派遣会社を追加する
                </ActionButton>
                <ActionButton
                  onClick={() => router.push("/system/haken/offices/new")}
                >
                  受入事業所を追加する
                </ActionButton>
              </>
            )}
          </div>
          <DataTable
            rows={data.parties}
            columns={partyColumns}
            rowKey={(p) => p.id}
            searchText={(p) =>
              [p.name, p.office_name, p.address, p.note].join(" ")
            }
            defaultSort={{ id: "name", direction: "asc" }}
            onRowClick={(p) => router.push(`/system/haken/parties/${p.id}`)}
          />
          <h2 className={styles.subheading}>受入事業所</h2>
          <DataTable
            rows={data.offices}
            columns={[
              { id: "name", label: "事業所名", type: "text", value: (o) => o.name },
              { id: "address", label: "所在地", type: "text", value: (o) => o.address },
            ]}
            rowKey={(o) => o.id}
            searchText={(o) => [o.name, o.address].join(" ")}
            defaultSort={{ id: "name", direction: "asc" }}
            onRowClick={(o) => router.push(`/system/haken/offices/${o.id}`)}
          />
        </>
      )}
      {tab === "deadlines" && (
        <DataTable
          rows={notices}
          rowKey={(n) => n.key}
          searchText={(n) => n.content + n.kind}
          columns={[
            {
              id: "due",
              label: "期限",
              type: "text",
              value: (n) => (n.kind === "個別契約書" ? "未回収" : n.due),
            },
            { id: "kind", label: "種類", type: "text", value: (n) => n.kind },
            {
              id: "content",
              label: "内容",
              type: "text",
              value: (n) => n.content,
            },
          ]}
          defaultSort={{ id: "due", direction: "asc" }}
          onRowClick={(n) => router.push(`/system/haken/ukeire/${n.workerId}`)}
        />
      )}
    </main>
  );
}
