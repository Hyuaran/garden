"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import BoxSelect from "@/app/system/_components/BoxSelect/BoxSelect";
import DataTable, { type DataColumn } from "@/app/system/_components/DataTable/DataTable";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import UpdatedStamp, { UpdatedStampRow } from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import { ActionButton, ResultMessage, StatusBadge } from "@/app/system/forms/_components/form-kit";
import styles from "@/app/soil/soil.module.css";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { LEAF_MENUS } from "../_constants/menus";
import { CASE_DETAIL_ERROR, CASE_LIST_ERROR, CASE_TABS, caseListHref, type CaseList, type CaseRow, type KandenTab } from "./cases";
import { type Submission } from "@/lib/leaf-kanden/submissions";
import { FormIntake, PhotoPasswordSettings } from "./FormIntake";
import CaseDialog from "./CaseDialog";
import { loadCaseDetail } from "./actions";
import detailStyles from "./case-dialog.module.css";

const rowFields = [
  ["kanri_no", "管理番号", "text", "fixed"],
  ["ordered_on", "受注日", "date", "fixed"],
  ["customer_name", "お客様名", "text", "text"],
  ["acquisition", "区分", "text", "mark"],
  ["contract_type", "契約種別", "text", "text"],
  ["progress", "進捗", "text", "mark"],
  ["entered_on", "エントリー日", "date", "fixed"],
  ["app_sent_on", "申込送付日", "date", "fixed"],
  ["invoice_sent_on", "請求送付日", "date", "fixed"],
  ["sales_name", "受注者", "text", "text"],
  ["clerk_name", "事務担当", "text", "text"],
] as const;

const columns: DataColumn<CaseRow>[] = rowFields.map(([id, label, type, align]) => ({
  id, label, type, align,
  value: row => id === "kanri_no" ? row.kanri_no ?? row.kanri_no_raw ?? "" : row[id] ?? "",
}));
columns.push({
  id: "photo_count", label: "写メ", type: "number", value: row => row.photo_count,
  render: row => <span className={row.photo_count ? detailStyles.count : detailStyles.zero}>{row.photo_count}</span>,
});

const formatCount = new Intl.NumberFormat("ja-JP");

export default function KandenCases({ list, year, currentYear, tab, search, intake, firstIntakeYear, settingsAllowed, linkedOrder }: {
  list: CaseList | null; year: number; currentYear: number; tab: KandenTab; search: string;
  intake?: Submission[] | null; firstIntakeYear?: number; settingsAllowed?: boolean;
  linkedOrder?: ReturnType<typeof loadCaseDetail> | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<{ row: CaseRow; read: ReturnType<typeof loadCaseDetail> } | null>(null);
  const [settings, setSettings] = useState(false);
  const [saved, setSaved] = useState(false);
  const isIntake = tab === "forms";
  const intakeYears = Array.from({ length: Math.max(1, currentYear - (firstIntakeYear ?? currentYear) + 1) }, (_, index) => currentYear - index);
  const years = [...new Set([currentYear, year, ...(isIntake ? intakeYears : list?.years ?? [])])].sort((a, b) => b - a);
  const intakeUpdate = intake?.reduce((latest, row) => row.updated_at > latest ? row.updated_at : latest, "") || null;
  return (
    <section className={styles.pageShell}>
      <SystemBreadcrumb root={{ label: "Leaf", href: "/leaf" }} items={[{ label: "関電" }]} />
      <h1 data-page-search-heading>{LEAF_MENUS[0].title}</h1>
      <UpdatedStampRow>
        {isIntake ? <UpdatedStamp label="フォーム受付" date={intakeUpdate} emptyText="記録なし" showSeconds
          onRefresh={() => router.refresh()} refreshLabel="フォーム受付を読み直す" /> :
          <UpdatedStamp label="FileMaker 取り込み" date={list?.updatedAt} emptyText="記録なし"
            title="画面からの取り直しはできません" />}
      </UpdatedStampRow>
      <SystemTabs aria-label="関電の案件一覧" actions={settingsAllowed &&
        <ActionButton onClick={() => { setSaved(false); setSettings(true); }}>画像保存の設定</ActionButton>}>
        {CASE_TABS.map(item => (
          <Link key={item.key} href={caseListHref(year, item.key, search)} prefetch={false}
            aria-current={item.key === tab ? "page" : undefined}>
            {item.label} {list && <StatusBadge muted>{formatCount.format(list.counts[item.key])}</StatusBadge>}
          </Link>
        ))}
        <Link href={caseListHref(year, "forms", search)} prefetch={false} aria-current={isIntake ? "page" : undefined}>フォーム受付 {isIntake && intake && <StatusBadge muted>{formatCount.format(intake.length)}</StatusBadge>}</Link>
      </SystemTabs>
      {saved && <ResultMessage success>画像保存のパスワードを設定しました。</ResultMessage>}
      {isIntake ? <>
        <ResultMessage>{!intake && "フォーム受付を読み込めませんでした。もう一度お試しください。"}</ResultMessage>
        <BoxSelect label="送信した年度" multiple={false} value={[String(year)]}
          options={years.map(option => ({ value: String(option), label: `${option}年度` }))}
          onChange={([value]) => { if (Number(value) !== year) router.push(caseListHref(Number(value), tab, search)); }} />
        {intake && <FormIntake rows={intake} year={year} />}
      </> : <>
        <ResultMessage>{!list && CASE_LIST_ERROR}</ResultMessage>
        {list && (
          <>
            <BoxSelect label="受注した年度" multiple={false} value={[String(year)]}
              options={years.map(option => ({ value: String(option), label: `${option}年度` }))}
              onChange={([value]) => { if (Number(value) !== year) router.push(caseListHref(Number(value), tab, search)); }} />
            {!list.hasOrders ? <p>FileMaker の受注はまだ取り込まれていません。</p> : (
              <div {...CLARITY_MASK}>
                <DataTable rows={list.rows} columns={columns} rowKey={row => row.id}
                  defaultSort={{ id: "ordered_on", direction: "desc" }}
                  summary={rows => `件数 ${formatCount.format(rows.length)} 件 ／ 写メあり ${formatCount.format(rows.filter(row => row.photo_count > 0).length)} 件`}
                  searchText={row => [row.kanri_no, row.kanri_no_raw, row.customer_name, row.customer_kana, row.address].join(" ")}
                  searchPlaceholder="管理番号・お客様名・カナ・住所"
                  emptyText="該当する案件はありません。"
                  onRowClick={row => setSelected({
                    row, read: loadCaseDetail(row.id).catch(() => ({ error: CASE_DETAIL_ERROR })),
                  })} />
              </div>
            )}
          </>
        )}
      </>}
      {settings && <PhotoPasswordSettings onClose={() => setSettings(false)} onSaved={() => {
        setSettings(false);
        setSaved(true);
      }} />}
      {linkedOrder && <CaseDialog row={{ kanri_no: null, kanri_no_raw: null, customer_name: null }} read={linkedOrder}
        onClose={() => router.replace(caseListHref(year, tab, search))} />}
      {selected && <CaseDialog row={selected.row} read={selected.read} onClose={() => setSelected(null)} />}
    </section>
  );
}
