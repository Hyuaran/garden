"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../_components/PageHeader";
import { Button } from "../_components/Button";
import { DataTable, Column } from "../_components/DataTable";
import { StatusBadge } from "../_components/StatusBadge";
import { Modal } from "../_components/Modal";
import { TextField, SelectField, FormGrid, TextareaField } from "../_components/FormField";
import { fetchEmployees, upsertEmployee, setEmployeeActive, fetchCompanies, fetchSalarySystems } from "../_lib/queries";
import type { Employee, Company, SalarySystem } from "../_constants/types";
import { colors } from "../_constants/colors";
import { useRootState } from "../_state/RootStateContext";
import { writeAudit } from "../_lib/audit";
import {
  validateEmployee,
  hasErrors,
  VALIDATION_ERROR_BANNER,
  type FieldErrors,
} from "../_lib/validators";
import { useMasterShortcuts } from "../_lib/useMasterShortcuts";
import { sanitizeUpsertPayload, NULLABLE_DATE_KEYS } from "../_lib/sanitize-payload";

/**
 * 雇用形態選択肢。DB 値（value）と UI ラベル（label）を分離。
 * Phase A-3-g で 'outsource' を追加（DB は英語、UI は「外注」表示）。
 */
const EMP_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "正社員",    label: "正社員" },
  { value: "アルバイト", label: "アルバイト" },
  { value: "outsource", label: "外注" },
];
const ACCOUNT_TYPES = ["普通", "当座"];
const INS_TYPES = ["加入", "未加入", "一部加入"];

/**
 * 年末調整の甲/乙欄区分（Phase A-3-h）。DB 値は英語コード、UI は日本語表示。
 */
const KOU_OTSU_OPTIONS: Array<{ value: "" | "kou" | "otsu"; label: string }> = [
  { value: "",    label: "（未設定）" },
  { value: "kou", label: "甲欄（主な収入）" },
  { value: "otsu", label: "乙欄（副業）" },
];

const empty = (nextId: string, companyId: string, salarySystemId: string): Employee => ({
  employee_id: nextId,
  employee_number: "",
  name: "",
  name_kana: "",
  company_id: companyId,
  employment_type: "正社員",
  salary_system_id: salarySystemId,
  hire_date: new Date().toISOString().slice(0, 10),
  termination_date: null,
  contract_end_on: null,
  kou_otsu: null,
  dependents_count: 0,
  deleted_at: null,
  email: "",
  bank_name: "",
  bank_code: "",
  branch_name: "",
  branch_code: "",
  account_type: "普通",
  account_number: "",
  account_holder: "",
  account_holder_kana: "",
  kot_employee_id: null,
  mf_employee_id: null,
  insurance_type: "加入",
  is_active: true,
  notes: null,
  created_at: "",
  updated_at: "",
});

function nextId(existing: Employee[]): string {
  const nums = existing.map((e) => parseInt(e.employee_id.replace("EMP-", ""), 10)).filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `EMP-${String(max + 1).padStart(4, "0")}`;
}

export default function EmployeesPage() {
  const { canWrite, rootUser } = useRootState();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [salarySystems, setSalarySystems] = useState<SalarySystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  async function load() {
    try {
      setLoading(true); setError(null);
      const [e, c, s] = await Promise.all([fetchEmployees(), fetchCompanies(), fetchSalarySystems()]);
      setEmployees(e); setCompanies(c); setSalarySystems(s);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!editTarget) setErrors({}); }, [editTarget]);

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.company_id, c])), [companies]);
  const salaryMap = useMemo(() => new Map(salarySystems.map((s) => [s.salary_system_id, s])), [salarySystems]);

  const filtered = useMemo(() => {
    let list = employees;
    if (filterCompany) list = list.filter((e) => e.company_id === filterCompany);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(s) || e.name_kana.toLowerCase().includes(s) || e.employee_number.toLowerCase().includes(s));
    }
    return list;
  }, [employees, filterCompany, search]);

  const { activeIndex } = useMasterShortcuts<Employee>({
    rows: filtered,
    modalOpen: !!editTarget,
    searchRef,
    onEditRow: canWrite ? setEditTarget : undefined,
  });

  async function handleSave() {
    if (!editTarget) return;
    if (!canWrite) {
      await writeAudit({
        action: "permission_denied",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_employees",
        payload: { attempted: "save" },
      });
      setError("編集権限がありません");
      return;
    }
    const errs = validateEmployee(editTarget);
    if (hasErrors(errs)) {
      setErrors(errs);
      setError(VALIDATION_ERROR_BANNER);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setErrors({});
      await upsertEmployee(
        sanitizeUpsertPayload(editTarget, { nullableDateKeys: NULLABLE_DATE_KEYS.employees }) as Partial<Employee> & { employee_id: string },
      );
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_employees",
        targetId: editTarget.employee_id,
        payload: { value: editTarget },
      });
      setEditTarget(null);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleToggleActive(e: Employee) {
    if (!canWrite) {
      await writeAudit({
        action: "permission_denied",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_employees",
        payload: { attempted: "toggle_active" },
      });
      setError("編集権限がありません");
      return;
    }
    try {
      await setEmployeeActive(e.employee_id, !e.is_active);
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_employees",
        targetId: e.employee_id,
        payload: { toggle_active: !e.is_active },
      });
      await load();
    } catch (err) { setError((err as Error).message); }
  }

  const columns: Column<Employee>[] = [
    { key: "id", header: "ID", render: (e) => e.employee_id, width: 100 },
    { key: "num", header: "社員番号", render: (e) => e.employee_number, width: 90 },
    { key: "name", header: "氏名", render: (e) => e.name, width: 120 },
    { key: "kana", header: "カナ", render: (e) => e.name_kana, width: 160 },
    { key: "company", header: "法人", render: (e) => companyMap.get(e.company_id)?.company_name ?? e.company_id, width: 160 },
    { key: "emp_type", header: "雇用形態", render: (e) => e.employment_type, width: 80 },
    { key: "salary", header: "給与体系", render: (e) => salaryMap.get(e.salary_system_id)?.system_name ?? e.salary_system_id, width: 130 },
    { key: "hire", header: "入社日", render: (e) => e.hire_date, width: 110 },
    { key: "status", header: "状態", render: (e) => <StatusBadge active={e.is_active} />, width: 80, align: "center" },
    { key: "actions", header: "", render: (e) => (
      <div style={{ display: "flex", gap: 6 }} onClick={(ev) => ev.stopPropagation()}>
        <Button variant="secondary" onClick={() => setEditTarget(e)} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>編集</Button>
        <Button variant={e.is_active ? "danger" : "primary"} onClick={() => handleToggleActive(e)} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>{e.is_active ? "無効化" : "有効化"}</Button>
      </div>
    ), width: 170, align: "right" },
  ];

  const canAdd = companies.length > 0 && salarySystems.length > 0;

  return (
    <>
      <PageHeader
        title="従業員マスタ"
        description="給与処理対象者。退職時は退職日を入力し無効化。業務委託は登録対象外。Ctrl+F 検索・Ctrl+↑↓ 行移動・Ctrl+Enter 編集。"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${colors.border}`, fontSize: 13 }}>
              <option value="">すべての法人</option>
              {companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
            </select>
            <input ref={searchRef} type="search" placeholder="氏名・番号で検索（Ctrl+F）" value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${colors.border}`, fontSize: 13, minWidth: 200 }} />
            <Button onClick={() => setEditTarget(empty(nextId(employees), companies[0]?.company_id ?? "", salarySystems[0]?.salary_system_id ?? ""))} disabled={!canAdd || !canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>+ 新規追加</Button>
          </div>
        }
      />
      {!canAdd && !loading && <div style={{ background: colors.warningBg, color: colors.warning, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13 }}>従業員を追加するには、先に法人マスタと給与体系マスタを登録してください。</div>}
      {error && <div style={{ background: colors.dangerBg, color: colors.danger, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {loading ? <div style={{ color: colors.textMuted, padding: 40, textAlign: "center" }}>読込中...</div> : <DataTable columns={columns} rows={filtered} activeIndex={activeIndex} onRowClick={canWrite ? setEditTarget : undefined} />}

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} onSubmit={handleSave} title={editTarget?.created_at ? "従業員を編集" : "従業員を追加"} width={860}>
        {editTarget && (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px 0", color: colors.textMuted }}>基本情報</h3>
            <FormGrid cols={3}>
              <TextField label="従業員ID" required value={editTarget.employee_id} onChange={(e) => setEditTarget({ ...editTarget, employee_id: e.target.value })} disabled={!!editTarget.created_at} error={errors.employee_id} />
              <TextField label="社員番号" required value={editTarget.employee_number} onChange={(e) => setEditTarget({ ...editTarget, employee_number: e.target.value })} error={errors.employee_number} />
              <SelectField label="所属法人" required value={editTarget.company_id} onChange={(e) => setEditTarget({ ...editTarget, company_id: e.target.value })} error={errors.company_id}>
                {companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
              </SelectField>
              <TextField label="氏名" required value={editTarget.name} onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })} error={errors.name} />
              <TextField label="氏名カナ" required value={editTarget.name_kana} onChange={(e) => setEditTarget({ ...editTarget, name_kana: e.target.value })} error={errors.name_kana} />
              <TextField label="メールアドレス" required type="email" value={editTarget.email} onChange={(e) => setEditTarget({ ...editTarget, email: e.target.value })} error={errors.email} />
              <SelectField label="雇用形態" required value={editTarget.employment_type} onChange={(e) => setEditTarget({
                ...editTarget,
                employment_type: e.target.value,
                // 外注以外を選ぶと契約終了日をクリア
                contract_end_on: e.target.value === "outsource" ? (editTarget.contract_end_on ?? null) : null,
              })} error={errors.employment_type}>
                {EMP_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </SelectField>
              <SelectField label="給与体系" required value={editTarget.salary_system_id} onChange={(e) => setEditTarget({ ...editTarget, salary_system_id: e.target.value })} error={errors.salary_system_id}>
                {salarySystems.map((s) => <option key={s.salary_system_id} value={s.salary_system_id}>{s.system_name}</option>)}
              </SelectField>
              <SelectField label="社会保険区分" required value={editTarget.insurance_type} onChange={(e) => setEditTarget({ ...editTarget, insurance_type: e.target.value })} error={errors.insurance_type}>
                {INS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </SelectField>
              <TextField label="入社日" required type="date" value={editTarget.hire_date} onChange={(e) => setEditTarget({ ...editTarget, hire_date: e.target.value })} error={errors.hire_date} />
              <TextField label="退職日" type="date" value={editTarget.termination_date ?? ""} onChange={(e) => setEditTarget({ ...editTarget, termination_date: e.target.value || null })} error={errors.termination_date} />
              {editTarget.employment_type === "outsource" && (
                <TextField
                  label="契約終了日（外注）"
                  type="date"
                  value={editTarget.contract_end_on ?? ""}
                  onChange={(e) => setEditTarget({ ...editTarget, contract_end_on: e.target.value || null })}
                  error={errors.contract_end_on}
                />
              )}
            </FormGrid>

            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "16px 0 8px 0", color: colors.textMuted }}>振込先口座</h3>
            <FormGrid cols={3}>
              <TextField label="銀行名" required value={editTarget.bank_name} onChange={(e) => setEditTarget({ ...editTarget, bank_name: e.target.value })} error={errors.bank_name} />
              <TextField label="金融機関コード（4桁）" required maxLength={4} inputMode="numeric" value={editTarget.bank_code} onChange={(e) => setEditTarget({ ...editTarget, bank_code: e.target.value })} error={errors.bank_code} />
              <SelectField label="口座種別" required value={editTarget.account_type} onChange={(e) => setEditTarget({ ...editTarget, account_type: e.target.value })}>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </SelectField>
              <TextField label="支店名" required value={editTarget.branch_name} onChange={(e) => setEditTarget({ ...editTarget, branch_name: e.target.value })} error={errors.branch_name} />
              <TextField label="支店コード（3桁）" required maxLength={3} inputMode="numeric" value={editTarget.branch_code} onChange={(e) => setEditTarget({ ...editTarget, branch_code: e.target.value })} error={errors.branch_code} />
              <TextField label="口座番号（7桁）" required maxLength={7} inputMode="numeric" value={editTarget.account_number} onChange={(e) => setEditTarget({ ...editTarget, account_number: e.target.value })} error={errors.account_number} />
              <TextField label="口座名義" required value={editTarget.account_holder} onChange={(e) => setEditTarget({ ...editTarget, account_holder: e.target.value })} error={errors.account_holder} />
              <TextField label="口座名義カナ" required value={editTarget.account_holder_kana} onChange={(e) => setEditTarget({ ...editTarget, account_holder_kana: e.target.value })} error={errors.account_holder_kana} />
            </FormGrid>

            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "16px 0 8px 0", color: colors.textMuted }}>給与・源泉徴収（Phase A-3-h）</h3>
            <FormGrid>
              <SelectField
                label="年末調整 甲/乙欄"
                value={editTarget.kou_otsu ?? ""}
                onChange={(e) => setEditTarget({
                  ...editTarget,
                  kou_otsu: (e.target.value || null) as "kou" | "otsu" | null,
                })}
                error={errors.kou_otsu}
              >
                {KOU_OTSU_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SelectField>
              <TextField
                label="扶養家族人数（0〜20）"
                type="number"
                min={0}
                max={20}
                step={1}
                value={editTarget.dependents_count ?? 0}
                onChange={(e) => setEditTarget({
                  ...editTarget,
                  dependents_count: e.target.value === "" ? 0 : Number(e.target.value),
                })}
                error={errors.dependents_count}
              />
            </FormGrid>

            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "16px 0 8px 0", color: colors.textMuted }}>外部ID連携</h3>
            <FormGrid>
              <TextField label="キングオブタイムID" value={editTarget.kot_employee_id ?? ""} onChange={(e) => setEditTarget({ ...editTarget, kot_employee_id: e.target.value || null })} />
              <TextField label="MFクラウド給与ID" value={editTarget.mf_employee_id ?? ""} onChange={(e) => setEditTarget({ ...editTarget, mf_employee_id: e.target.value || null })} />
            </FormGrid>
            <TextareaField label="備考" value={editTarget.notes ?? ""} onChange={(e) => setEditTarget({ ...editTarget, notes: e.target.value || null })} />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
              <Button variant="secondary" onClick={() => setEditTarget(null)} disabled={saving}>キャンセル</Button>
              <Button onClick={handleSave} disabled={saving || !canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
