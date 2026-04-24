"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../_components/PageHeader";
import { Button } from "../_components/Button";
import { DataTable, Column } from "../_components/DataTable";
import { StatusBadge } from "../_components/StatusBadge";
import { Modal } from "../_components/Modal";
import { TextField, FormGrid } from "../_components/FormField";
import { fetchInsurance, upsertInsurance, setInsuranceActive } from "../_lib/queries";
import type { Insurance } from "../_constants/types";
import { colors } from "../_constants/colors";
import { useRootState } from "../_state/RootStateContext";
import { writeAudit } from "../_lib/audit";
import {
  validateInsurance,
  hasErrors,
  VALIDATION_ERROR_BANNER,
  type FieldErrors,
} from "../_lib/validators";
import { useMasterShortcuts } from "../_lib/useMasterShortcuts";

const emptyInsurance = (year: string): Insurance => ({
  insurance_id: `INS-${year}`,
  fiscal_year: year,
  effective_from: `${year}-04-01`,
  effective_to: `${Number(year) + 1}-03-31`,
  health_insurance_rate: 4.905,
  nursing_insurance_rate: 0.8,
  pension_rate: 9.15,
  employment_insurance_rate: 0.6,
  child_support_rate: 0.05,
  grade_table: [],
  is_active: true,
  created_at: "",
  updated_at: "",
});

export default function InsurancePage() {
  const { canWrite, rootUser } = useRootState();
  const [rows, setRows] = useState<Insurance[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Insurance | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const { activeIndex } = useMasterShortcuts<Insurance>({
    rows,
    modalOpen: !!editTarget,
    onEditRow: canWrite ? setEditTarget : undefined,
  });

  async function load() {
    try { setLoading(true); setError(null); setRows(await fetchInsurance()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!editTarget) setErrors({}); }, [editTarget]);

  async function handleSave() {
    if (!editTarget) return;
    if (!canWrite) {
      await writeAudit({
        action: "permission_denied",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_insurance",
        payload: { attempted: "save" },
      });
      setError("編集権限がありません");
      return;
    }
    const errs = validateInsurance(editTarget);
    if (hasErrors(errs)) {
      setErrors(errs);
      setError(VALIDATION_ERROR_BANNER);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setErrors({});
      await upsertInsurance(editTarget);
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_insurance",
        targetId: editTarget.insurance_id,
        payload: { value: editTarget },
      });
      setEditTarget(null);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleToggleActive(r: Insurance) {
    if (!canWrite) {
      await writeAudit({
        action: "permission_denied",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_insurance",
        payload: { attempted: "toggle_active" },
      });
      setError("編集権限がありません");
      return;
    }
    try {
      await setInsuranceActive(r.insurance_id, !r.is_active);
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_insurance",
        targetId: r.insurance_id,
        payload: { toggle_active: !r.is_active },
      });
      await load();
    } catch (e) { setError((e as Error).message); }
  }

  const columns: Column<Insurance>[] = [
    { key: "id",    header: "ID",           render: (r) => r.insurance_id, width: 110 },
    { key: "year",  header: "年度",         render: (r) => r.fiscal_year,  width: 70 },
    { key: "from",  header: "開始",         render: (r) => r.effective_from, width: 120 },
    { key: "to",    header: "終了",         render: (r) => r.effective_to ?? "—", width: 120 },
    { key: "health", header: "健康保険",    render: (r) => `${r.health_insurance_rate}%`, width: 90, align: "right" },
    { key: "nursing", header: "介護",        render: (r) => `${r.nursing_insurance_rate}%`, width: 80, align: "right" },
    { key: "pension", header: "厚生年金",    render: (r) => `${r.pension_rate}%`, width: 90, align: "right" },
    { key: "emp",    header: "雇用保険",    render: (r) => `${r.employment_insurance_rate}%`, width: 90, align: "right" },
    { key: "child",  header: "子育て支援",  render: (r) => `${r.child_support_rate}%`, width: 100, align: "right" },
    { key: "status", header: "状態",        render: (r) => <StatusBadge active={r.is_active} />, width: 80, align: "center" },
    { key: "actions", header: "", render: (r) => (
      <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
        <Button variant="secondary" onClick={() => setEditTarget(r)} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>編集</Button>
        <Button variant={r.is_active ? "danger" : "primary"} onClick={() => handleToggleActive(r)} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>{r.is_active ? "無効化" : "有効化"}</Button>
      </div>
    ), width: 170, align: "right" },
  ];

  return (
    <>
      <PageHeader
        title="社会保険マスタ"
        description="年度ごとの保険料率。毎年4月に新年度を追加。Ctrl+↑↓ 行移動・Ctrl+Enter 編集。"
        actions={<Button onClick={() => setEditTarget(emptyInsurance(String(new Date().getFullYear())))} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>+ 新規追加</Button>}
      />
      {error && <div style={{ background: colors.dangerBg, color: colors.danger, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {loading ? <div style={{ color: colors.textMuted, padding: 40, textAlign: "center" }}>読込中...</div> : <DataTable columns={columns} rows={rows} activeIndex={activeIndex} onRowClick={canWrite ? setEditTarget : undefined} />}

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} onSubmit={handleSave} title={editTarget?.created_at ? "保険料率を編集" : "保険料率を追加"} width={720}>
        {editTarget && (
          <div>
            <FormGrid>
              <TextField label="保険マスタID" required value={editTarget.insurance_id} onChange={(e) => setEditTarget({ ...editTarget, insurance_id: e.target.value })} disabled={!!editTarget.created_at} error={errors.insurance_id} />
              <TextField label="適用年度（4桁）" required maxLength={4} inputMode="numeric" value={editTarget.fiscal_year} onChange={(e) => setEditTarget({ ...editTarget, fiscal_year: e.target.value })} error={errors.fiscal_year} />
              <TextField label="適用開始日" type="date" required value={editTarget.effective_from} onChange={(e) => setEditTarget({ ...editTarget, effective_from: e.target.value })} error={errors.effective_from} />
              <TextField label="適用終了日" type="date" value={editTarget.effective_to ?? ""} onChange={(e) => setEditTarget({ ...editTarget, effective_to: e.target.value || null })} error={errors.effective_to} />
              <TextField label="健康保険料率（%）" type="number" step="0.001" min={0} max={100} value={editTarget.health_insurance_rate} onChange={(e) => setEditTarget({ ...editTarget, health_insurance_rate: Number(e.target.value) })} error={errors.health_insurance_rate} />
              <TextField label="介護保険料率（%）" type="number" step="0.001" min={0} max={100} value={editTarget.nursing_insurance_rate} onChange={(e) => setEditTarget({ ...editTarget, nursing_insurance_rate: Number(e.target.value) })} error={errors.nursing_insurance_rate} />
              <TextField label="厚生年金保険料率（%）" type="number" step="0.001" min={0} max={100} value={editTarget.pension_rate} onChange={(e) => setEditTarget({ ...editTarget, pension_rate: Number(e.target.value) })} error={errors.pension_rate} />
              <TextField label="雇用保険料率（%）" type="number" step="0.001" min={0} max={100} value={editTarget.employment_insurance_rate} onChange={(e) => setEditTarget({ ...editTarget, employment_insurance_rate: Number(e.target.value) })} error={errors.employment_insurance_rate} />
              <TextField label="子ども・子育て支援金率（%）" type="number" step="0.001" min={0} max={100} value={editTarget.child_support_rate} onChange={(e) => setEditTarget({ ...editTarget, child_support_rate: Number(e.target.value) })} error={errors.child_support_rate} />
            </FormGrid>
            <div style={{ background: colors.infoBg, color: colors.info, padding: "8px 12px", borderRadius: 4, fontSize: 12, marginTop: 8 }}>
              等級テーブル（grade_table）はUIからの編集未対応です。Supabaseダッシュボードで直接編集してください。
            </div>
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
