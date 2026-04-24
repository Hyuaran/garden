"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../_components/PageHeader";
import { Button } from "../_components/Button";
import { DataTable, Column } from "../_components/DataTable";
import { StatusBadge } from "../_components/StatusBadge";
import { Modal } from "../_components/Modal";
import { TextField, SelectField, FormGrid, TextareaField } from "../_components/FormField";
import { fetchSalarySystems, upsertSalarySystem, setSalarySystemActive } from "../_lib/queries";
import type { SalarySystem } from "../_constants/types";
import { colors } from "../_constants/colors";
import { useRootState } from "../_state/RootStateContext";
import { writeAudit } from "../_lib/audit";

const EMP_TYPES = ["正社員", "アルバイト", "共通"];
const BASE_TYPES = ["月給", "時給", "日給"];

const emptySystem = (nextId: string): SalarySystem => ({
  salary_system_id: nextId,
  system_name: "",
  employment_type: "正社員",
  base_salary_type: "月給",
  working_hours_day: 7.0,
  working_days_month: 20,
  overtime_rate: 1.25,
  night_overtime_rate: 1.35,
  holiday_overtime_rate: 1.35,
  allowances: null,
  deductions: null,
  is_active: true,
  notes: null,
  created_at: "",
  updated_at: "",
});

function nextId(existing: SalarySystem[]): string {
  const nums = existing.map((s) => parseInt(s.salary_system_id.replace("SAL-SYS-", ""), 10)).filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `SAL-SYS-${String(max + 1).padStart(3, "0")}`;
}

export default function SalarySystemsPage() {
  const { canWrite, rootUser } = useRootState();
  const [systems, setSystems] = useState<SalarySystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<SalarySystem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try { setLoading(true); setError(null); setSystems(await fetchSalarySystems()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!editTarget) return;
    if (!canWrite) {
      await writeAudit({
        action: "permission_denied",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_salary_systems",
        payload: { attempted: "save" },
      });
      setError("編集権限がありません");
      return;
    }
    try {
      setSaving(true);
      await upsertSalarySystem(editTarget);
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_salary_systems",
        targetId: editTarget.salary_system_id,
        payload: { value: editTarget },
      });
      setEditTarget(null);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleToggleActive(s: SalarySystem) {
    if (!canWrite) {
      await writeAudit({
        action: "permission_denied",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_salary_systems",
        payload: { attempted: "toggle_active" },
      });
      setError("編集権限がありません");
      return;
    }
    try {
      await setSalarySystemActive(s.salary_system_id, !s.is_active);
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_salary_systems",
        targetId: s.salary_system_id,
        payload: { toggle_active: !s.is_active },
      });
      await load();
    } catch (e) { setError((e as Error).message); }
  }

  const columns: Column<SalarySystem>[] = [
    { key: "id", header: "ID", render: (s) => s.salary_system_id, width: 140 },
    { key: "name", header: "体系名", render: (s) => s.system_name, width: 200 },
    { key: "emp", header: "対象", render: (s) => s.employment_type, width: 100 },
    { key: "base", header: "基本給", render: (s) => s.base_salary_type, width: 80 },
    { key: "hours", header: "所定時間/日", render: (s) => `${s.working_hours_day}h`, width: 110, align: "right" },
    { key: "days", header: "所定日数/月", render: (s) => `${s.working_days_month}日`, width: 110, align: "right" },
    { key: "ot", header: "残業/深夜/休日", render: (s) => `${s.overtime_rate} / ${s.night_overtime_rate} / ${s.holiday_overtime_rate}`, width: 160 },
    { key: "status", header: "状態", render: (s) => <StatusBadge active={s.is_active} />, width: 80, align: "center" },
    { key: "actions", header: "", render: (s) => (
      <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
        <Button variant="secondary" onClick={() => setEditTarget(s)} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>編集</Button>
        <Button variant={s.is_active ? "danger" : "primary"} onClick={() => handleToggleActive(s)} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>{s.is_active ? "無効化" : "有効化"}</Button>
      </div>
    ), width: 170, align: "right" },
  ];

  return (
    <>
      <PageHeader
        title="給与体系マスタ"
        description="雇用形態別の給与計算ルール。従業員マスタから紐づけて使用。"
        actions={<Button onClick={() => setEditTarget(emptySystem(nextId(systems)))} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>+ 新規追加</Button>}
      />
      {error && <div style={{ background: colors.dangerBg, color: colors.danger, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {loading ? <div style={{ color: colors.textMuted, padding: 40, textAlign: "center" }}>読込中...</div> : <DataTable columns={columns} rows={systems} />}

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={editTarget?.created_at ? "給与体系を編集" : "給与体系を追加"} width={720}>
        {editTarget && (
          <div>
            <FormGrid>
              <TextField label="給与体系ID" required value={editTarget.salary_system_id} onChange={(e) => setEditTarget({ ...editTarget, salary_system_id: e.target.value })} disabled={!!editTarget.created_at} />
              <TextField label="体系名" required value={editTarget.system_name} onChange={(e) => setEditTarget({ ...editTarget, system_name: e.target.value })} />
              <SelectField label="対象雇用形態" required value={editTarget.employment_type} onChange={(e) => setEditTarget({ ...editTarget, employment_type: e.target.value })}>
                {EMP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </SelectField>
              <SelectField label="基本給計算方法" required value={editTarget.base_salary_type} onChange={(e) => setEditTarget({ ...editTarget, base_salary_type: e.target.value })}>
                {BASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </SelectField>
              <TextField label="所定労働時間（日）" type="number" step="0.1" value={editTarget.working_hours_day} onChange={(e) => setEditTarget({ ...editTarget, working_hours_day: Number(e.target.value) })} />
              <TextField label="所定労働日数（月）" type="number" step="0.1" value={editTarget.working_days_month} onChange={(e) => setEditTarget({ ...editTarget, working_days_month: Number(e.target.value) })} />
              <TextField label="残業単価倍率（法定外）" type="number" step="0.01" value={editTarget.overtime_rate} onChange={(e) => setEditTarget({ ...editTarget, overtime_rate: Number(e.target.value) })} />
              <TextField label="残業単価倍率（深夜）" type="number" step="0.01" value={editTarget.night_overtime_rate} onChange={(e) => setEditTarget({ ...editTarget, night_overtime_rate: Number(e.target.value) })} />
              <TextField label="残業単価倍率（休日）" type="number" step="0.01" value={editTarget.holiday_overtime_rate} onChange={(e) => setEditTarget({ ...editTarget, holiday_overtime_rate: Number(e.target.value) })} />
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
