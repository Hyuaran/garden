"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../_components/PageHeader";
import { Button } from "../_components/Button";
import { DataTable, Column } from "../_components/DataTable";
import { StatusBadge } from "../_components/StatusBadge";
import { Modal } from "../_components/Modal";
import { TextField, SelectField, FormGrid } from "../_components/FormField";
import { fetchBankAccounts, upsertBankAccount, setBankAccountActive, fetchCompanies } from "../_lib/queries";
import type { BankAccount, Company } from "../_constants/types";
import { colors } from "../_constants/colors";

const ACCOUNT_TYPES = ["普通", "当座"];
const PURPOSES = ["メイン", "給与", "経費", "その他"];

const empty = (nextId: string, companyId: string): BankAccount => ({
  account_id: nextId,
  company_id: companyId,
  bank_name: "",
  bank_code: "",
  branch_name: "",
  branch_code: "",
  account_type: "普通",
  account_number: "",
  account_holder: "",
  purpose: null,
  is_active: true,
  created_at: "",
  updated_at: "",
});

function nextId(existing: BankAccount[]): string {
  const nums = existing.map((a) => parseInt(a.account_id.replace("ACC-", ""), 10)).filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `ACC-${String(max + 1).padStart(3, "0")}`;
}

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [editTarget, setEditTarget] = useState<BankAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true); setError(null);
      const [a, c] = await Promise.all([fetchBankAccounts(), fetchCompanies()]);
      setAccounts(a); setCompanies(c);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.company_id, c])), [companies]);
  const filtered = useMemo(() => filterCompany ? accounts.filter((a) => a.company_id === filterCompany) : accounts, [accounts, filterCompany]);

  async function handleSave() {
    if (!editTarget) return;
    try { setSaving(true); await upsertBankAccount(editTarget); setEditTarget(null); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleToggleActive(a: BankAccount) {
    try { await setBankAccountActive(a.account_id, !a.is_active); await load(); }
    catch (e) { setError((e as Error).message); }
  }

  const columns: Column<BankAccount>[] = [
    { key: "id", header: "ID", render: (a) => a.account_id, width: 90 },
    { key: "company", header: "法人", render: (a) => companyMap.get(a.company_id)?.company_name ?? a.company_id, width: 180 },
    { key: "bank", header: "銀行", render: (a) => `${a.bank_name} (${a.bank_code})`, width: 180 },
    { key: "branch", header: "支店", render: (a) => `${a.branch_name} (${a.branch_code})`, width: 160 },
    { key: "type", header: "種別", render: (a) => a.account_type, width: 60 },
    { key: "number", header: "口座番号", render: (a) => a.account_number, width: 100 },
    { key: "holder", header: "名義", render: (a) => a.account_holder },
    { key: "purpose", header: "用途", render: (a) => a.purpose ?? "—", width: 80 },
    { key: "status", header: "状態", render: (a) => <StatusBadge active={a.is_active} />, width: 80, align: "center" },
    { key: "actions", header: "", render: (a) => (
      <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
        <Button variant="secondary" onClick={() => setEditTarget(a)}>編集</Button>
        <Button variant={a.is_active ? "danger" : "primary"} onClick={() => handleToggleActive(a)}>{a.is_active ? "無効化" : "有効化"}</Button>
      </div>
    ), width: 170, align: "right" },
  ];

  return (
    <>
      <PageHeader
        title="銀行口座マスタ"
        description="法人ごとの振込元口座。新しい銀行を追加するとここに登録される。"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${colors.border}`, fontSize: 13 }}>
              <option value="">すべての法人</option>
              {companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
            </select>
            <Button onClick={() => setEditTarget(empty(nextId(accounts), companies[0]?.company_id ?? ""))} disabled={companies.length === 0}>+ 新規追加</Button>
          </div>
        }
      />
      {error && <div style={{ background: colors.dangerBg, color: colors.danger, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {loading ? <div style={{ color: colors.textMuted, padding: 40, textAlign: "center" }}>読込中...</div> : <DataTable columns={columns} rows={filtered} />}

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={editTarget?.created_at ? "銀行口座を編集" : "銀行口座を追加"} width={720}>
        {editTarget && (
          <div>
            <FormGrid>
              <TextField label="口座ID" required value={editTarget.account_id} onChange={(e) => setEditTarget({ ...editTarget, account_id: e.target.value })} disabled={!!editTarget.created_at} />
              <SelectField label="法人" required value={editTarget.company_id} onChange={(e) => setEditTarget({ ...editTarget, company_id: e.target.value })}>
                {companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
              </SelectField>
              <TextField label="銀行名" required value={editTarget.bank_name} onChange={(e) => setEditTarget({ ...editTarget, bank_name: e.target.value })} />
              <TextField label="金融機関コード（4桁）" required maxLength={4} value={editTarget.bank_code} onChange={(e) => setEditTarget({ ...editTarget, bank_code: e.target.value })} />
              <TextField label="支店名" required value={editTarget.branch_name} onChange={(e) => setEditTarget({ ...editTarget, branch_name: e.target.value })} />
              <TextField label="支店コード（3桁）" required maxLength={3} value={editTarget.branch_code} onChange={(e) => setEditTarget({ ...editTarget, branch_code: e.target.value })} />
              <SelectField label="口座種別" required value={editTarget.account_type} onChange={(e) => setEditTarget({ ...editTarget, account_type: e.target.value })}>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </SelectField>
              <TextField label="口座番号（7桁）" required maxLength={7} value={editTarget.account_number} onChange={(e) => setEditTarget({ ...editTarget, account_number: e.target.value })} />
              <TextField label="口座名義" required value={editTarget.account_holder} onChange={(e) => setEditTarget({ ...editTarget, account_holder: e.target.value })} />
              <SelectField label="用途" value={editTarget.purpose ?? ""} onChange={(e) => setEditTarget({ ...editTarget, purpose: e.target.value || null })}>
                <option value="">—</option>
                {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
              </SelectField>
            </FormGrid>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
              <Button variant="secondary" onClick={() => setEditTarget(null)} disabled={saving}>キャンセル</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
