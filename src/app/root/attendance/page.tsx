"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../_components/PageHeader";
import { Button } from "../_components/Button";
import { DataTable, Column } from "../_components/DataTable";
import { Modal } from "../_components/Modal";
import { TextField, SelectField, FormGrid } from "../_components/FormField";
import { fetchAttendance, upsertAttendance, fetchEmployees } from "../_lib/queries";
import type { Attendance, Employee } from "../_constants/types";
import { colors } from "../_constants/colors";
import { useRootState } from "../_state/RootStateContext";
import { writeAudit } from "../_lib/audit";
import {
  validateAttendance,
  hasErrors,
  VALIDATION_ERROR_BANNER,
  type FieldErrors,
} from "../_lib/validators";
import { useMasterShortcuts } from "../_lib/useMasterShortcuts";

const STATUSES = ["未取込", "取込済", "エラー"];

const empty = (employeeId: string, targetMonth: string): Attendance => ({
  attendance_id: `ATT-${targetMonth}-${employeeId.replace("EMP-", "")}`,
  employee_id: employeeId,
  target_month: targetMonth,
  working_days: 0,
  absence_days: 0,
  paid_leave_days: 0,
  scheduled_hours: 0,
  actual_hours: 0,
  overtime_hours: 0,
  legal_overtime_hours: 0,
  night_hours: 0,
  holiday_hours: 0,
  late_hours: 0,
  early_leave_hours: 0,
  training_hours: null,
  office_hours: null,
  imported_at: null,
  import_status: "未取込",
  kot_record_id: null,
  created_at: "",
  updated_at: "",
});

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AttendancePage() {
  const { canWrite, rootUser } = useRootState();
  const [rows, setRows] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<string>(currentMonth());
  const [editTarget, setEditTarget] = useState<Attendance | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const { activeIndex } = useMasterShortcuts<Attendance>({
    rows,
    modalOpen: !!editTarget,
    onEditRow: canWrite ? setEditTarget : undefined,
  });

  async function load() {
    try {
      setLoading(true); setError(null);
      const [a, e] = await Promise.all([fetchAttendance(month), fetchEmployees()]);
      setRows(a); setEmployees(e);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [month]);
  useEffect(() => { if (!editTarget) setErrors({}); }, [editTarget]);

  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.employee_id, e])), [employees]);

  async function handleSave() {
    if (!editTarget) return;
    if (!canWrite) {
      await writeAudit({
        action: "permission_denied",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_attendance",
        payload: { attempted: "save" },
      });
      setError("編集権限がありません");
      return;
    }
    const errs = validateAttendance(editTarget);
    if (hasErrors(errs)) {
      setErrors(errs);
      setError(VALIDATION_ERROR_BANNER);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setErrors({});
      await upsertAttendance(editTarget);
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_attendance",
        targetId: editTarget.attendance_id,
        payload: { value: editTarget },
      });
      setEditTarget(null);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  const columns: Column<Attendance>[] = [
    { key: "id", header: "ID", render: (r) => r.attendance_id, width: 160 },
    { key: "emp", header: "従業員", render: (r) => employeeMap.get(r.employee_id)?.name ?? r.employee_id, width: 140 },
    { key: "month", header: "対象月", render: (r) => r.target_month, width: 90 },
    { key: "wd", header: "出勤", render: (r) => `${r.working_days}日`, width: 70, align: "right" },
    { key: "ad", header: "欠勤", render: (r) => `${r.absence_days}日`, width: 70, align: "right" },
    { key: "pl", header: "有給", render: (r) => `${r.paid_leave_days}日`, width: 70, align: "right" },
    { key: "ah", header: "実労働", render: (r) => `${r.actual_hours}h`, width: 80, align: "right" },
    { key: "ot", header: "残業", render: (r) => `${r.overtime_hours}h`, width: 70, align: "right" },
    { key: "nh", header: "深夜", render: (r) => `${r.night_hours}h`, width: 70, align: "right" },
    { key: "hh", header: "休出", render: (r) => `${r.holiday_hours}h`, width: 70, align: "right" },
    { key: "status", header: "取込", render: (r) => r.import_status, width: 80 },
    { key: "actions", header: "", render: (r) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Button variant="secondary" onClick={() => setEditTarget(r)} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>編集</Button>
      </div>
    ), width: 80, align: "right" },
  ];

  return (
    <>
      <PageHeader
        title="勤怠データ"
        description="キングオブタイムから取込（月次）。手動編集も可能。Ctrl+↑↓ 行移動・Ctrl+Enter 編集。"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${colors.border}`, fontSize: 13 }} />
            <Button onClick={() => setEditTarget(empty(employees[0]?.employee_id ?? "", month))} disabled={employees.length === 0 || !canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>+ 手動追加</Button>
          </div>
        }
      />
      <div style={{ background: colors.infoBg, color: colors.info, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
        キングオブタイムAPI連携は未実装。現在は手動登録/編集のみ対応。
      </div>
      {error && <div style={{ background: colors.dangerBg, color: colors.danger, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {loading ? <div style={{ color: colors.textMuted, padding: 40, textAlign: "center" }}>読込中...</div> : <DataTable columns={columns} rows={rows} activeIndex={activeIndex} onRowClick={canWrite ? setEditTarget : undefined} emptyMessage={`${month} の勤怠データがありません`} />}

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} onSubmit={handleSave} title={editTarget?.created_at ? "勤怠データを編集" : "勤怠データを追加"} width={760}>
        {editTarget && (
          <div>
            <FormGrid cols={3}>
              <TextField label="勤怠ID" required value={editTarget.attendance_id} onChange={(e) => setEditTarget({ ...editTarget, attendance_id: e.target.value })} disabled={!!editTarget.created_at} error={errors.attendance_id} />
              <SelectField label="従業員" required value={editTarget.employee_id} onChange={(e) => setEditTarget({ ...editTarget, employee_id: e.target.value })} error={errors.employee_id}>
                {employees.map((emp) => <option key={emp.employee_id} value={emp.employee_id}>{emp.name}</option>)}
              </SelectField>
              <TextField label="対象月（YYYY-MM）" required value={editTarget.target_month} onChange={(e) => setEditTarget({ ...editTarget, target_month: e.target.value })} error={errors.target_month} />
              <TextField label="出勤日数" type="number" step="0.5" min={0} max={31} value={editTarget.working_days} onChange={(e) => setEditTarget({ ...editTarget, working_days: Number(e.target.value) })} error={errors.working_days} />
              <TextField label="欠勤日数" type="number" step="0.5" min={0} max={31} value={editTarget.absence_days} onChange={(e) => setEditTarget({ ...editTarget, absence_days: Number(e.target.value) })} error={errors.absence_days} />
              <TextField label="有給取得日数" type="number" step="0.5" min={0} max={31} value={editTarget.paid_leave_days} onChange={(e) => setEditTarget({ ...editTarget, paid_leave_days: Number(e.target.value) })} error={errors.paid_leave_days} />
              <TextField label="所定労働時間" type="number" step="0.1" min={0} max={744} value={editTarget.scheduled_hours} onChange={(e) => setEditTarget({ ...editTarget, scheduled_hours: Number(e.target.value) })} error={errors.scheduled_hours} />
              <TextField label="実労働時間" type="number" step="0.1" min={0} max={744} value={editTarget.actual_hours} onChange={(e) => setEditTarget({ ...editTarget, actual_hours: Number(e.target.value) })} error={errors.actual_hours} />
              <TextField label="所定外時間（平日）" type="number" step="0.1" min={0} max={744} value={editTarget.overtime_hours} onChange={(e) => setEditTarget({ ...editTarget, overtime_hours: Number(e.target.value) })} error={errors.overtime_hours} />
              <TextField label="法定外時間（平日）" type="number" step="0.1" min={0} max={744} value={editTarget.legal_overtime_hours} onChange={(e) => setEditTarget({ ...editTarget, legal_overtime_hours: Number(e.target.value) })} error={errors.legal_overtime_hours} />
              <TextField label="深夜時間" type="number" step="0.1" min={0} max={744} value={editTarget.night_hours} onChange={(e) => setEditTarget({ ...editTarget, night_hours: Number(e.target.value) })} error={errors.night_hours} />
              <TextField label="休日出勤時間" type="number" step="0.1" min={0} max={744} value={editTarget.holiday_hours} onChange={(e) => setEditTarget({ ...editTarget, holiday_hours: Number(e.target.value) })} error={errors.holiday_hours} />
              <TextField label="遅刻時間" type="number" step="0.1" min={0} max={744} value={editTarget.late_hours} onChange={(e) => setEditTarget({ ...editTarget, late_hours: Number(e.target.value) })} error={errors.late_hours} />
              <TextField label="早退時間" type="number" step="0.1" min={0} max={744} value={editTarget.early_leave_hours} onChange={(e) => setEditTarget({ ...editTarget, early_leave_hours: Number(e.target.value) })} error={errors.early_leave_hours} />
              <TextField label="研修時間（任意）" type="number" step="0.1" min={0} max={744} value={editTarget.training_hours ?? ""} onChange={(e) => setEditTarget({ ...editTarget, training_hours: e.target.value === "" ? null : Number(e.target.value) })} error={errors.training_hours} />
              <TextField label="事務時間（任意）" type="number" step="0.1" min={0} max={744} value={editTarget.office_hours ?? ""} onChange={(e) => setEditTarget({ ...editTarget, office_hours: e.target.value === "" ? null : Number(e.target.value) })} error={errors.office_hours} />
              <SelectField label="取込ステータス" required value={editTarget.import_status} onChange={(e) => setEditTarget({ ...editTarget, import_status: e.target.value })} error={errors.import_status}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </SelectField>
            </FormGrid>
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
