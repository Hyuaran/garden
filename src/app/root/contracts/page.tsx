"use client";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "../_components/PageHeader";
import { colors } from "../_constants/colors";
import type {
  ContractEmployee,
  ContractRow,
  EmploymentContractPayload,
} from "./_lib/employment-contract";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const initial = (): EmploymentContractPayload => ({
  kind: "new",
  contractStart: "",
  contractEnd: "",
  jobType: "sales",
  jobTypeOther: "",
  hourlyWage: 0,
  workLocation: "",
  concludedOn: today(),
  employeeAddress: "",
});
export default function ContractsPage() {
  const [employees, setEmployees] = useState<ContractEmployee[]>([]),
    [rows, setRows] = useState<ContractRow[]>([]),
    [employeeId, setEmployeeId] = useState(""),
    [p, setP] = useState(initial),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  async function load() {
    const r = await fetch("/api/root/contracts");
    const j = await r.json();
    if (r.ok) {
      setEmployees(j.employees ?? []);
      setRows(j.rows ?? []);
    } else setError(j.error ?? "読み込めませんでした。");
  }
  useEffect(() => {
    // Initial API hydration is intentionally performed once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  function choose(id: string) {
    setEmployeeId(id);
    const e = employees.find((x) => x.employee_id === id);
    const address =
      e?.root_companies?.address?.replace(/^〒\d{3}-\d{4}\s*/, "") ?? "";
    setP((v) => ({
      ...v,
      workLocation: address ? `${address}（または甲が指定する場所）` : "",
    }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const r = await fetch("/api/root/contracts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ employee_id: employeeId, payload: p }),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) return setError(j.error ?? "発行できませんでした。");
    setP(initial());
    setEmployeeId("");
    await load();
  }
  async function retry(id: string) {
    await fetch("/api/root/contracts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }
  return (
    <div>
      <PageHeader
        title="雇用契約書の発行"
        description="クルー向けの雇用契約書 兼 労働条件通知書を発行します"
      />
      {error ? (
        <p
          role="alert"
          style={{
            background: colors.dangerBg,
            color: colors.danger,
            padding: 10,
          }}
        >
          {error}
        </p>
      ) : null}
      <form
        onSubmit={submit}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(240px,1fr))",
          gap: 12,
          padding: 18,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          background: colors.bgPanel,
        }}
      >
        <label>
          従業員
          <select
            required
            value={employeeId}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">選択してください</option>
            {employees.map((e) => (
              <option key={e.employee_id} value={e.employee_id}>
                {e.employee_number}・{e.name}・
                {e.root_companies?.company_name ?? "会社未設定"}・
                {e.employment_type}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>区分</legend>
          {[
            ["new", "新規"],
            ["renewal", "更新"],
          ].map(([v, l]) => (
            <label key={v}>
              <input
                type="radio"
                name="kind"
                value={v}
                checked={p.kind === v}
                onChange={() =>
                  setP({ ...p, kind: v as EmploymentContractPayload["kind"] })
                }
              />
              {l}
            </label>
          ))}
        </fieldset>
        {[
          ["contractStart", "契約期間（から）", "date"],
          ["contractEnd", "契約期間（まで）", "date"],
          ["hourlyWage", "基本賃金（時給・円）", "number"],
          ["concludedOn", "通知日及び締結日", "date"],
          ["workLocation", "就業場所", "text"],
          ["employeeAddress", "従業員住所（任意）", "text"],
        ].map(([key, label, type]) => (
          <label key={key}>
            {label}
            <input
              type={type}
              required={key !== "employeeAddress"}
              value={String(p[key as keyof EmploymentContractPayload])}
              onChange={(e) =>
                setP({
                  ...p,
                  [key]:
                    key === "hourlyWage"
                      ? Number(e.target.value)
                      : e.target.value,
                })
              }
            />
          </label>
        ))}
        <label>
          業務内容
          <select
            value={p.jobType}
            onChange={(e) =>
              setP({
                ...p,
                jobType: e.target.value as EmploymentContractPayload["jobType"],
              })
            }
          >
            {[
              ["sales", "営業職"],
              ["office", "事務職"],
              ["tech", "技術職"],
              ["other", "その他"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {p.jobType === "other" ? (
          <label>
            その他の内容
            <input
              required
              value={p.jobTypeOther}
              onChange={(e) => setP({ ...p, jobTypeOther: e.target.value })}
            />
          </label>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          style={{ gridColumn: "1/-1", padding: 10 }}
        >
          {saving ? "発行中…" : "PDFを発行"}
        </button>
      </form>
      <h2>発行履歴</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              padding: 12,
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              background: colors.bgPanel,
            }}
          >
            <strong>{r.root_employees?.name ?? r.employee_id}</strong>　
            {r.root_employees?.root_companies?.company_name ?? ""}　
            {r.payload.kind === "new" ? "新規" : "更新"}　
            {r.payload.contractStart}～{r.payload.contractEnd}　時給{" "}
            {Number(r.payload.hourlyWage).toLocaleString()}円　PDF:{" "}
            {r.pdf_status}
            <span style={{ float: "right" }}>
              {r.pdf_status === "generated" && r.pdf_drive_url ? (
                <a href={r.pdf_drive_url} target="_blank" rel="noreferrer">
                  PDFを開く
                </a>
              ) : (
                <button onClick={() => void retry(r.id)}>PDF再生成</button>
              )}
            </span>
            <div style={{ fontSize: 12, color: colors.textMuted }}>
              {new Date(r.created_at).toLocaleString("ja-JP")}
              {r.pdf_note ? ` ／ ${r.pdf_note}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
