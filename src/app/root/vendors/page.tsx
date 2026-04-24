"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../_components/PageHeader";
import { Button } from "../_components/Button";
import { DataTable, Column } from "../_components/DataTable";
import { StatusBadge } from "../_components/StatusBadge";
import { Modal } from "../_components/Modal";
import { TextField, SelectField, FormGrid, TextareaField } from "../_components/FormField";
import { fetchVendors, upsertVendor, setVendorActive, fetchCompanies } from "../_lib/queries";
import type { Vendor, Company } from "../_constants/types";
import { colors } from "../_constants/colors";
import { useRootState } from "../_state/RootStateContext";
import { writeAudit } from "../_lib/audit";
import {
  validateVendor,
  hasErrors,
  VALIDATION_ERROR_BANNER,
  type FieldErrors,
} from "../_lib/validators";
import { useMasterShortcuts } from "../_lib/useMasterShortcuts";
import { sanitizeUpsertPayload, NULLABLE_DATE_KEYS } from "../_lib/sanitize-payload";

const VENDOR_TYPES = ["外注先", "仕入先", "その他"];
const ACCOUNT_TYPES = ["普通", "当座"];
const FEE_BEARERS = ["当方負担", "先方負担"];

const empty = (nextId: string): Vendor => ({
  vendor_id: nextId,
  vendor_name: "",
  vendor_name_kana: "",
  vendor_type: null,
  bank_name: "",
  bank_code: "",
  branch_name: "",
  branch_code: "",
  account_type: "普通",
  account_number: "",
  account_holder_kana: "",
  fee_bearer: "当方負担",
  company_id: null,
  notes: null,
  is_active: true,
  created_at: "",
  updated_at: "",
});

function nextId(existing: Vendor[]): string {
  const nums = existing.map((v) => parseInt(v.vendor_id.replace("VND-", ""), 10)).filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `VND-${String(max + 1).padStart(3, "0")}`;
}

export default function VendorsPage() {
  const { canWrite, rootUser } = useRootState();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  async function load() {
    try {
      setLoading(true); setError(null);
      const [v, c] = await Promise.all([fetchVendors(), fetchCompanies()]);
      setVendors(v); setCompanies(c);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!editTarget) setErrors({}); }, [editTarget]);

  const filtered = useMemo(() => {
    if (!search) return vendors;
    const s = search.toLowerCase();
    return vendors.filter((v) => v.vendor_name.toLowerCase().includes(s) || v.vendor_name_kana.toLowerCase().includes(s) || v.vendor_id.toLowerCase().includes(s));
  }, [vendors, search]);

  const { activeIndex } = useMasterShortcuts<Vendor>({
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
        targetType: "root_vendors",
        payload: { attempted: "save" },
      });
      setError("編集権限がありません");
      return;
    }
    const errs = validateVendor(editTarget);
    if (hasErrors(errs)) {
      setErrors(errs);
      setError(VALIDATION_ERROR_BANNER);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setErrors({});
      await upsertVendor(
        sanitizeUpsertPayload(editTarget, { nullableDateKeys: NULLABLE_DATE_KEYS.vendors }) as Partial<Vendor> & { vendor_id: string },
      );
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_vendors",
        targetId: editTarget.vendor_id,
        payload: { value: editTarget },
      });
      setEditTarget(null);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleToggleActive(v: Vendor) {
    if (!canWrite) {
      await writeAudit({
        action: "permission_denied",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_vendors",
        payload: { attempted: "toggle_active" },
      });
      setError("編集権限がありません");
      return;
    }
    try {
      await setVendorActive(v.vendor_id, !v.is_active);
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_vendors",
        targetId: v.vendor_id,
        payload: { toggle_active: !v.is_active },
      });
      await load();
    } catch (e) { setError((e as Error).message); }
  }

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.company_id, c])), [companies]);

  const columns: Column<Vendor>[] = [
    { key: "id", header: "ID", render: (v) => v.vendor_id, width: 90 },
    { key: "name", header: "取引先名", render: (v) => v.vendor_name, width: 200 },
    { key: "kana", header: "カナ", render: (v) => v.vendor_name_kana, width: 200 },
    { key: "type", header: "区分", render: (v) => v.vendor_type ?? "—", width: 80 },
    { key: "bank", header: "振込先", render: (v) => `${v.bank_name} ${v.branch_name} ${v.account_type}${v.account_number}` },
    { key: "fee", header: "手数料", render: (v) => v.fee_bearer, width: 90 },
    { key: "company", header: "担当法人", render: (v) => v.company_id ? companyMap.get(v.company_id)?.company_name ?? v.company_id : "—", width: 140 },
    { key: "status", header: "状態", render: (v) => <StatusBadge active={v.is_active} />, width: 80, align: "center" },
    { key: "actions", header: "", render: (v) => (
      <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
        <Button variant="secondary" onClick={() => setEditTarget(v)} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>編集</Button>
        <Button variant={v.is_active ? "danger" : "primary"} onClick={() => handleToggleActive(v)} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>{v.is_active ? "無効化" : "有効化"}</Button>
      </div>
    ), width: 170, align: "right" },
  ];

  return (
    <>
      <PageHeader
        title="取引先マスタ"
        description="振込先（外注先・仕入先等）の口座情報。Ctrl+F で検索・Ctrl+↑↓ で行移動・Ctrl+Enter で編集。"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={searchRef} type="search" placeholder="取引先名・カナ・IDで検索（Ctrl+F）" value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${colors.border}`, fontSize: 13, minWidth: 240 }} />
            <Button onClick={() => setEditTarget(empty(nextId(vendors)))} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>+ 新規追加</Button>
          </div>
        }
      />
      {error && <div style={{ background: colors.dangerBg, color: colors.danger, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {loading ? <div style={{ color: colors.textMuted, padding: 40, textAlign: "center" }}>読込中...</div> : <DataTable columns={columns} rows={filtered} activeIndex={activeIndex} onRowClick={canWrite ? setEditTarget : undefined} />}

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} onSubmit={handleSave} title={editTarget?.created_at ? "取引先を編集" : "取引先を追加"} width={720}>
        {editTarget && (
          <div>
            <FormGrid>
              <TextField label="取引先ID" required value={editTarget.vendor_id} onChange={(e) => setEditTarget({ ...editTarget, vendor_id: e.target.value })} disabled={!!editTarget.created_at} error={errors.vendor_id} />
              <SelectField label="区分" value={editTarget.vendor_type ?? ""} onChange={(e) => setEditTarget({ ...editTarget, vendor_type: e.target.value || null })}>
                <option value="">—</option>
                {VENDOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </SelectField>
              <TextField label="取引先名" required value={editTarget.vendor_name} onChange={(e) => setEditTarget({ ...editTarget, vendor_name: e.target.value })} error={errors.vendor_name} />
              <TextField label="取引先名カナ" required value={editTarget.vendor_name_kana} onChange={(e) => setEditTarget({ ...editTarget, vendor_name_kana: e.target.value })} error={errors.vendor_name_kana} />
              <TextField label="銀行名" required value={editTarget.bank_name} onChange={(e) => setEditTarget({ ...editTarget, bank_name: e.target.value })} error={errors.bank_name} />
              <TextField label="金融機関コード（4桁）" required maxLength={4} inputMode="numeric" value={editTarget.bank_code} onChange={(e) => setEditTarget({ ...editTarget, bank_code: e.target.value })} error={errors.bank_code} />
              <TextField label="支店名" required value={editTarget.branch_name} onChange={(e) => setEditTarget({ ...editTarget, branch_name: e.target.value })} error={errors.branch_name} />
              <TextField label="支店コード（3桁）" required maxLength={3} inputMode="numeric" value={editTarget.branch_code} onChange={(e) => setEditTarget({ ...editTarget, branch_code: e.target.value })} error={errors.branch_code} />
              <SelectField label="口座種別" required value={editTarget.account_type} onChange={(e) => setEditTarget({ ...editTarget, account_type: e.target.value })} error={errors.account_type}>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </SelectField>
              <TextField label="口座番号（7桁）" required maxLength={7} inputMode="numeric" value={editTarget.account_number} onChange={(e) => setEditTarget({ ...editTarget, account_number: e.target.value })} error={errors.account_number} />
              <TextField label="口座名義カナ（全角）" required value={editTarget.account_holder_kana} onChange={(e) => setEditTarget({ ...editTarget, account_holder_kana: e.target.value })} error={errors.account_holder_kana} />
              <SelectField label="手数料負担" required value={editTarget.fee_bearer} onChange={(e) => setEditTarget({ ...editTarget, fee_bearer: e.target.value })} error={errors.fee_bearer}>
                {FEE_BEARERS.map((f) => <option key={f} value={f}>{f}</option>)}
              </SelectField>
              <SelectField label="担当法人" value={editTarget.company_id ?? ""} onChange={(e) => setEditTarget({ ...editTarget, company_id: e.target.value || null })}>
                <option value="">—</option>
                {companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
              </SelectField>
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
