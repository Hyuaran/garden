"use client";
import { useUrlTab } from "@/app/system/_components/SystemTabs/useUrlTab";
import { SystemViewHeading } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { useSystemView, SystemViewButton } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import FilterRow from "@/app/system/_components/FilterBox/FilterRow";
import FilterBox from "@/app/system/_components/FilterBox/FilterBox";
import { useEffect, useRef, useState } from "react";
import SproutShell from "./sprout-shell";

import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import UpdatedStamp from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import DataTable, { type DataColumn } from "@/app/system/_components/DataTable/DataTable";

import { canSend, filterApplicants, type ApplicantSummary } from "@/lib/sprout/model";
import { loadApplicantDetail, loadSprout, refreshSprout, sendToHire } from "./actions";

import styles from "./sprout.module.css";

type Data = Awaited<ReturnType<typeof loadSprout>>;
const todayJst = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
const showDate = (s: string | null) => !s ? "─" : s.includes("T") ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" }).format(new Date(s)) : s;
const labels: Record<string,string> = {
  文字列__1行__5: "応募日時", チェックボックス_3: "応募方法", チェックボックス_4: "理由1", チェックボックス_5: "理由2",
  チェックボックス_0: "勤務可能曜日", チェックボックス_1: "働き方", ドロップダウン_4: "出勤希望時間帯", ドロップダウン_5: "退勤希望時間帯",
  時給_1: "時給1", 時給_2: "時給2", 希望給与: "希望給与", チェックボックス_2: "初出勤日希望",
  日時: "面接希望日時1", 日時_0: "面接希望日時2", 日時_1: "面接希望日時3", チェックボックス_6: "希望面接方法", ドロップダウン_6: "面接方法", リンク: "Web面接URL",
  "配属・異動": "求人の記録", 文字列__複数行__0: "内容詳細", 内容詳細: "内容詳細", 日付_1: "日付", 入力者: "入力者", 結果: "結果", 時刻: "時刻",
  従業員名_姓名: "氏名", 従業員名_姓名カナ: "カナ", 従業員名_姓: "姓", 従業員名_名: "名", 従業員名_姓カナ: "セイ", 従業員名_名カナ: "メイ",
  連絡先_ハイフンなし: "電話", メールアドレス: "メール", 性別: "性別", 住所: "住所", 郵便番号: "郵便番号", 生年月日: "生年月日",
  文字列__1行_: "都道府県", 文字列__1行__0: "市町村", 文字列__1行__1: "連絡事項", 文字列__1行__2: "町域", 文字列__1行__3: "建物", 文字列__1行__4: "部屋番号",
  文字列__1行__15: "最終学歴学校名", 文字列__1行__16: "最終職歴会社名", 文字列__1行__10: "年齢", ドロップダウン_0: "最終学歴", ドロップダウン_2: "最終職歴", ドロップダウン_3: "勤務可能期間", チェックボックス: "コールセンター経験", 日付_0: "フォーム送信日",
};
function Value({ value }: { value: unknown }) {
  if (value == null || value === "") return <>─</>;
  if (Array.isArray(value)) {
    if (!value.length) return <>─</>;
    if (value.every(v => typeof v !== "object")) return <>{value.join("・")}</>;
    if (value.every(v => v && typeof v === "object" && "id" in v)) {
      const keys = [...new Set(value.flatMap(v => Object.keys(v)))].filter(k => k !== "id");
      return <div className={styles.recordTable}><table><thead><tr>{keys.map(k => <th key={k}>{labels[k] || "記録"}</th>)}</tr></thead><tbody>{value.map((v,i) => <tr key={i}>{keys.map(k => <td key={k} className={/日時|日付|時刻|番号|電話|時間帯|期間|曜日/.test(labels[k] || k) ? "garden-cell-fixed" : /時給|給与|年齢/.test(labels[k] || k) ? "garden-cell-number" : (labels[k] || k) === "結果" ? "garden-cell-mark" : "garden-cell-text"}><Value value={v[k]} /></td>)}</tr>)}</tbody></table></div>;
    }
    return <>{value.map(v => typeof v === "object" && v ? v.name || "" : String(v)).join("・")}</>;
  }
  const text = String(value);
  if (/^https?:\/\//.test(text)) return <a href={text} target="_blank" rel="noreferrer">開く</a>;
  return <>{/^\d{4}-\d{2}-\d{2}T/.test(text) ? showDate(text) : text}</>;
}
function Fields({ raw, keys }: { raw: Record<string, unknown>; keys: string[] }) {
  return <dl className={styles.fields}>{keys.map(k => <div key={k}><dt>{labels[k] || k}</dt><dd><Value value={raw[k]} /></dd></div>)}</dl>;
}
export default function Sprout() {
  const { allowedTab } = useSystemView();
  const initialTab = ["applicants", "interviews", "training"].find(key => allowedTab(key)) ?? "applicants";
  const [data, setData] = useState<Data>({ applicants: [], hearings: [], sent: [], updated: null });
  const [tab, setTab] = useUrlTab(initialTab, key => ["applicants", "interviews", "training"].includes(key) && allowedTab(key));
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  type Detail = Awaited<ReturnType<typeof loadApplicantDetail>>;
  const requests = useRef(new Map<string, Promise<Detail>>());
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!selected) return;
    const id = selected;
    let active = true;
    let request = requests.current.get(id);
    if (!request) {
      setDetailErrors(current => ({ ...current, [id]: "" }));
      request = loadApplicantDetail(id, tab);
      requests.current.set(id, request);
    }
    request.then(detail => {
      if (active) setDetails(current => ({ ...current, [id]: detail }));
    }).catch(() => {
      requests.current.delete(id);
      if (active) setDetailErrors(current => ({ ...current, [id]: "詳細を読み込めませんでした。開き直してお試しください" }));
    });
    return () => { active = false; };
  }, [selected, tab]);
  const detail = selected ? details[selected] : undefined;
  const detailLoading = <p role="status">{selected && detailErrors[selected] || "詳細を読み込んでいます…"}</p>;
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { let active = true; loadSprout(tab).then(d => { if (active) { setData(d); setLoaded(true); } }).catch(() => { if (active) setMessage("読み込めませんでした。時間をおいてお試しください"); }); return () => { active = false; }; }, [tab]);
  const row = data.applicants.find(a => a.kintone_record_id === selected);
  const filtered = filterApplicants(data.applicants, tab, "", [], search, todayJst());
  const columns: DataColumn<ApplicantSummary>[] = [
    { id: "applied_date", label: "応募日",  type: "date", value: a => a.applied_date || "", filterValue: a => a.applied_date?.slice(0,7) || "未設定" },
    { id: "name", label: "氏名", type: "text", value: a => a.name, render: a => <button className={styles.name} data-applicant-id={a.kintone_record_id} onClick={() => setSelected(a.kintone_record_id)}>{a.name || "氏名未登録"}</button> },
    { id: "age_group", label: "年代", align: "fixed", type: "text", value: a => a.age_group },
    { id: "method", label: "応募方法", type: "text", value: a => a.application_methods.join("・") },
    { id: "status", label: "状況", align: "mark", type: "text", value: a => a.status, filterValue: a => a.status || "未設定" },
    { id: "interview", label: "面接予定日時", type: "date", value: a => a.interview_at || "", render: a => showDate(a.interview_at) },
    { id: "training", label: "研修日",  type: "date", value: a => a.training_at || a.training_date || "", render: a => showDate(a.training_at || a.training_date) },
  ];
  async function refresh() {
    setBusy(true); setMessage("");
    try { const result = await refreshSprout(); if (!result.ok) setMessage(result.message || "取り込めませんでした"); else { setData(await loadSprout(tab)); setMessage("採用情報を取り込みました"); } }
    catch { setMessage("取り込めませんでした。時間をおいてお試しください"); } finally { setBusy(false); }
  }
  async function send(a: ApplicantSummary) {
    setBusy(true);
    try { const result = await sendToHire(a.kintone_record_id); setMessage(result.message); if (result.ok) setData(d => ({ ...d, sent: [...d.sent, a.kintone_record_id] })); }
    catch { setMessage("送れませんでした。時間をおいてお試しください"); } finally { setBusy(false); }
  }
  return <SproutShell current="採用管理"><div className={styles.heading}><SystemBreadcrumb root={{ label: "Sprout", href: "/sprout" }} items={[{ label: "採用管理" }]} /><SystemViewHeading showActions={["applicants", "interviews", "training"].filter(key => allowedTab(key)).length <= 1} actions={<SystemViewButton tabKey={tab} />}><h1>採用管理</h1></SystemViewHeading><UpdatedStamp label="Kintone取込" date={data.updated} onRefresh={refresh} busy={busy || !loaded} refreshLabel="採用情報を取り込む" /></div>
      <SystemTabs actions={<SystemViewButton tabKey={tab} />}>{[["applicants", "応募者"], ["interviews", "面接予定"], ["training", "研修予定"]].filter(([id]) => allowedTab(id)).map(([id,label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => { if (tab === id) return; setSelected(null); setLoaded(false); setData({applicants:[],hearings:[],sent:[],updated:null}); setTab(id); }}>{label}</button>)}</SystemTabs>
      <><FilterRow className={styles.filters}>
        <FilterBox label="名前・電話で探す" search><input type="search" value={search} onChange={e => setSearch(e.target.value)} /></FilterBox>
      </FilterRow>
      {!loaded && !message && <p role="status">採用情報を読み込んでいます…</p>}
      {message && <p role="status">{message}</p>}
      <div className={styles.content}><section className={styles.list} onClick={event => {
        const target = (event.target as HTMLElement).closest("tbody tr")?.querySelector<HTMLButtonElement>("[data-applicant-id]");
        if (target?.dataset.applicantId) setSelected(target.dataset.applicantId);
      }}><DataTable searchable={false} key={tab} defaultFilters={tab === "applicants" ? { applied_date: [todayJst().slice(0,7)] } : {}} rows={filtered} columns={columns} rowKey={a => a.kintone_record_id} searchText={a => a.name + a.phone} summary={r => loaded ? `${r.length}人` : "読み込み中…"} defaultSort={{ id: tab === "applicants" ? "applied_date" : tab === "interviews" ? "interview" : "training", direction: tab === "applicants" ? "desc" : "asc" }} /></section>
      {row && <section className={styles.detail} aria-label="応募者の詳細"><button onClick={() => setSelected(null)}>閉じる</button><h2>{row.name}</h2>
        <h3>基本</h3><dl className={styles.fields}>{[["カナ", row.kana], ["生年月日", row.birthday], ["性別", row.gender], ["電話", row.phone], ["メール", row.email], ["住所", row.address]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || "─"}</dd></div>)}</dl>
        <h3>応募</h3><p>応募日：{showDate(row.applied_date)} ／ {row.status}</p>{detail ? <Fields raw={detail.raw} keys={["文字列__1行__5", "チェックボックス_3", "チェックボックス_4", "チェックボックス_5"]} /> : detailLoading}
        <h3>希望</h3>{detail ? <Fields raw={detail.raw} keys={["チェックボックス_0", "チェックボックス_1", "ドロップダウン_4", "ドロップダウン_5", "時給_1", "時給_2", "希望給与", "チェックボックス_2"]} /> : detailLoading}
        <h3>面接</h3>{detail ? <Fields raw={detail.raw} keys={["日時", "日時_0", "日時_1", "チェックボックス_6", "ドロップダウン_6", "リンク"]} /> : detailLoading}<p>面接予定：{showDate(row.interview_at)} ／ 面接日：{showDate(row.interview_date)}</p>
        <h3>研修</h3><p>研修予定：{showDate(row.training_at)}</p><p>研修日：{showDate(row.training_date)} ／ 入社日：{showDate(row.hire_date)}</p>
        <h3>求人の記録</h3>{detail ? <Value value={detail.raw["配属・異動"]} /> : detailLoading}
        <h3>ヒアリングシート</h3>{detail ? <>{detail.hearings.map(h => <Fields key={h.kintone_record_id} raw={h.raw} keys={Object.keys(h.raw).filter(k => labels[k])} />)}{!detail.hearings.length && <p>記録はありません</p>}</> : detailLoading}
        {canSend(row.status) && <button disabled={busy || data.sent.includes(row.kintone_record_id)} onClick={() => send(row)}>{data.sent.includes(row.kintone_record_id) ? "入社予定者へ送付済み" : "入社予定者へ"}</button>}
      </section>}</div></>
  </SproutShell>;
}
