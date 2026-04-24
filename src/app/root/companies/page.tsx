"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../_components/PageHeader";
import { Button } from "../_components/Button";
import { DataTable, Column } from "../_components/DataTable";
import { StatusBadge } from "../_components/StatusBadge";
import { Modal } from "../_components/Modal";
import { TextField, SelectField, FormGrid } from "../_components/FormField";
import { fetchCompanies, upsertCompany, setCompanyActive } from "../_lib/queries";
import type { Company } from "../_constants/types";
import { DEFAULT_BANKS } from "../_constants/types";
import { colors } from "../_constants/colors";
import { useRootState } from "../_state/RootStateContext";
import { writeAudit } from "../_lib/audit";

const emptyCompany = (nextId: string): Company => ({
  company_id: nextId,
  company_name: "",
  company_name_kana: "",
  corporate_number: null,
  representative: "",
  address: "",
  phone: null,
  default_bank: "楽天銀行",
  is_active: true,
  created_at: "",
  updated_at: "",
});

function nextCompanyId(existing: Company[]): string {
  const nums = existing.map((c) => parseInt(c.company_id.replace("COMP-", ""), 10)).filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `COMP-${String(max + 1).padStart(3, "0")}`;
}

export default function CompaniesPage() {
  const { canWrite, rootUser } = useRootState();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setCompanies(await fetchCompanies());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!editTarget) return;
    if (!canWrite) {
      await writeAudit({
        action: "permission_denied",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_companies",
        payload: { attempted: "save" },
      });
      setError("編集権限がありません");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await upsertCompany(editTarget);
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_companies",
        targetId: editTarget.company_id,
        payload: { value: editTarget },
      });
      setEditTarget(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(c: Company) {
    if (!canWrite) {
      await writeAudit({
        action: "permission_denied",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_companies",
        payload: { attempted: "toggle_active" },
      });
      setError("編集権限がありません");
      return;
    }
    try {
      await setCompanyActive(c.company_id, !c.is_active);
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_companies",
        targetId: c.company_id,
        payload: { toggle_active: !c.is_active },
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const columns: Column<Company>[] = [
    { key: "id",       header: "ID",           render: (c) => c.company_id,        width: 100 },
    { key: "name",     header: "法人名",       render: (c) => c.company_name,      width: 220 },
    { key: "kana",     header: "カナ",         render: (c) => c.company_name_kana, width: 220 },
    { key: "rep",      header: "代表者",       render: (c) => c.representative,    width: 120 },
    { key: "bank",     header: "デフォルト銀行", render: (c) => c.default_bank,     width: 120 },
    { key: "phone",    header: "電話",         render: (c) => c.phone ?? "—" },
    { key: "status",   header: "状態",         render: (c) => <StatusBadge active={c.is_active} />, width: 80, align: "center" },
    { key: "actions",  header: "",             render: (c) => (
      <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
        <Button variant="secondary" onClick={() => setEditTarget(c)} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>編集</Button>
        <Button variant={c.is_active ? "danger" : "primary"} onClick={() => handleToggleActive(c)} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>
          {c.is_active ? "無効化" : "有効化"}
        </Button>
      </div>
    ), width: 170, align: "right" },
  ];

  return (
    <>
      <PageHeader
        title="法人マスタ"
        description="6法人の基本情報、デフォルト振込銀行。削除不可。"
        actions={
          <Button variant="primary" onClick={() => setEditTarget(emptyCompany(nextCompanyId(companies)))} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>
            + 新規追加
          </Button>
        }
      />

      {error && <div style={{ background: colors.dangerBg, color: colors.danger, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {loading ? (
        <div style={{ color: colors.textMuted, padding: 40, textAlign: "center" }}>読込中...</div>
      ) : (
        <DataTable columns={columns} rows={companies} emptyMessage="法人データがありません" />
      )}

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={editTarget?.created_at ? "法人を編集" : "法人を追加"} width={720}>
        {editTarget && (
          <div>
            <FormGrid>
              <TextField label="法人ID" required value={editTarget.company_id} onChange={(e) => setEditTarget({ ...editTarget, company_id: e.target.value })} disabled={!!editTarget.created_at} />
              <SelectField label="デフォルト振込銀行" required value={editTarget.default_bank} onChange={(e) => setEditTarget({ ...editTarget, default_bank: e.target.value })}>
                {DEFAULT_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </SelectField>
              <TextField label="法人名" required value={editTarget.company_name} onChange={(e) => setEditTarget({ ...editTarget, company_name: e.target.value })} />
              <TextField label="法人名カナ" required value={editTarget.company_name_kana} onChange={(e) => setEditTarget({ ...editTarget, company_name_kana: e.target.value })} />
              <TextField label="代表者名" required value={editTarget.representative} onChange={(e) => setEditTarget({ ...editTarget, representative: e.target.value })} />
              <TextField label="法人番号（13桁）" value={editTarget.corporate_number ?? ""} onChange={(e) => setEditTarget({ ...editTarget, corporate_number: e.target.value || null })} />
              <TextField label="電話番号" value={editTarget.phone ?? ""} onChange={(e) => setEditTarget({ ...editTarget, phone: e.target.value || null })} />
            </FormGrid>
            <TextField label="本店所在地" required value={editTarget.address} onChange={(e) => setEditTarget({ ...editTarget, address: e.target.value })} />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
              <Button variant="secondary" onClick={() => setEditTarget(null)} disabled={saving}>キャンセル</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving || !canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
