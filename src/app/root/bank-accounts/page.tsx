"use client";
import FilterRow from "@/app/system/_components/FilterBox/FilterRow";
import ChoiceFilter from "@/app/system/_components/ChoiceFilter";
import { useEffect, useMemo, useState } from "react";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { PageHeader } from "../_components/PageHeader";
import { Button } from "../_components/Button";
import { DataTable, Column } from "../_components/DataTable";
import { StatusBadge } from "../_components/StatusBadge";
import { Modal } from "../_components/Modal";
import { TextField, SelectField } from "../_components/FormField";
import { fetchBankAccounts, insertBankAccount, updateBankAccount, setBankAccountActive, fetchBankCorporations } from "../_lib/queries";
import type { BankAccount, BankCorporation } from "../_constants/types";
import { colors } from "../_constants/colors";
import { useRootState } from "../_state/RootStateContext";
import { writeAudit } from "../_lib/audit";
import { validateBankAccount, hasErrors, VALIDATION_ERROR_BANNER, type FieldErrors, } from "../_lib/validators";
import { useMasterShortcuts } from "../_lib/useMasterShortcuts";
import styles from "./page.module.css";
const ACCOUNT_TYPES = ["普通", "当座", "貯蓄"];
const BANKS = [{
  code: "mizuho",
  name: "みずほ銀行"
}, {
  code: "rakuten",
  name: "楽天銀行"
}, {
  code: "paypay",
  name: "PayPay銀行"
}, {
  code: "kyoto",
  name: "京都銀行"
}];
const CORPS = ["hyuaran", "centerrise", "linksupport", "arata", "taiyou", "ichi"];
const empty = (corp: string): BankAccount => ({
  id: "",
  corp_code: corp,
  bank_code: "mizuho",
  bank_name: "みずほ銀行",
  branch_name: "",
  branch_code: "",
  account_type: "普通",
  account_number: "",
  sub_account_label: "",
  has_csv_export: true,
  needs_manual_balance: false,
  notes: "",
  is_active: true,
  created_at: "",
  updated_at: "",
});
export default function BankAccountsPage() {
  const { canWrite, rootUser } = useRootState();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [companies, setCompanies] = useState<BankCorporation[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [editTarget, setEditTarget] = useState<BankAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [a, c] = await Promise.all([fetchBankAccounts(), fetchBankCorporations()]);
      setAccounts(a);
      setCompanies(c.filter((corp) => CORPS.includes(corp.id)));
    }
    catch (e) {
      setError(e instanceof Error && /^(同じ法人|銀行口座を保存)/.test(e.message) ? e.message : "銀行口座の処理に失敗しました。もう一度お試しください。");
    }
    finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!editTarget)
      setErrors({});
  }, [editTarget]);
  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const filtered = useMemo(() => {
    const companyOrder = new Map(companies.map((company, index) => [company.id, index]));
    return accounts
      .filter((account) => !filterCompany || account.corp_code === filterCompany)
      .sort((a, b) => (companyOrder.get(a.corp_code) ?? companies.length) -
        (companyOrder.get(b.corp_code) ?? companies.length) ||
        a.bank_code.localeCompare(b.bank_code) ||
        a.account_number.localeCompare(b.account_number));
  }, [accounts, companies, filterCompany]);
  const { activeIndex } = useMasterShortcuts<BankAccount>({
    rows: filtered,
    modalOpen: !!editTarget,
    onEditRow: canWrite ? setEditTarget : undefined,
  });
  async function handleSave() {
    if (!editTarget)
      return;
    if (!canWrite) {
      await writeAudit({
        action: "permission_denied",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_bank_accounts",
        payload: { attempted: "save" },
      });
      setError("編集権限がありません");
      return;
    }
    const account = {
      ...editTarget,
      branch_name: editTarget.branch_name?.trim() || null,
      branch_code: editTarget.branch_code?.trim() || null,
      sub_account_label: editTarget.sub_account_label?.trim() || null,
      notes: editTarget.notes?.trim() || null,
    };
    const errs = validateBankAccount(account);
    if (hasErrors(errs)) {
      setErrors(errs);
      setError(VALIDATION_ERROR_BANNER);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setErrors({});
      const savedId = editTarget.id ? (await updateBankAccount(account), editTarget.id) : await insertBankAccount(account);
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_bank_accounts",
        targetId: savedId,
        payload: { value: editTarget },
      });
      setEditTarget(null);
      await load();
    }
    catch (e) {
      setError((e as Error).message);
    }
    finally {
      setSaving(false);
    }
  }
  async function handleToggleActive(a: BankAccount) {
    if (!canWrite) {
      await writeAudit({
        action: "permission_denied",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_bank_accounts",
        payload: { attempted: "toggle_active" },
      });
      setError("編集権限がありません");
      return;
    }
    try {
      await setBankAccountActive(a.id, !a.is_active);
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_bank_accounts",
        targetId: a.id,
        payload: { toggle_active: !a.is_active },
      });
      await load();
    }
    catch (e) {
      setError((e as Error).message);
    }
  }
  const columns: Column<BankAccount>[] = [
    {
      key: "company",
      header: "法人",
      align: "left",
      render: (a) => companyMap.get(a.corp_code)?.name_short ?? a.corp_code,
    },
    {
      key: "bank",
      header: "口座",
      align: "left",
      render: (a) => <><div>{a.bank_name}</div><div className={styles.branch}>{[a.branch_name, a.branch_code].filter(Boolean).join(" / ")}</div></>,
    },
    {
      key: "number",
      header: "口座番号",
      align: "center",
      render: (a) => <span className={styles.number}>{a.account_type} <span {...CLARITY_MASK}>{a.account_number}</span></span>,
    },
    {
      key: "sub",
      header: "弥生の補助科目名",
      render: a => a.sub_account_label
        ? a.sub_account_label.split(/(?<=[_)])/).map((part, index) => <span key={index}>{part}<wbr /></span>)
        : "—",
    },
    {
      key: "import",
      header: "明細の取り込み",
      render: a => [a.has_csv_export && "CSV", a.needs_manual_balance && "残高を手入力"].filter(Boolean).join(" / ") || "—"
    },
    {
      key: "status",
      header: "状態",
      render: (a) => <StatusBadge active={a.is_active} />,
      align: "center"
    },
    {
      key: "actions",
      header: "操作",
      render: (a) => (<div style={{
        display: "flex",
        gap: 6
      }} onClick={(e) => e.stopPropagation()}>        <Button
          variant="secondary"
          onClick={() => setEditTarget(a)}
          disabled={!canWrite}
          title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}
        >編集</Button>        <Button
          variant={a.is_active ? "danger" : "primary"}
          onClick={() => handleToggleActive(a)}
          disabled={!canWrite}
          title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}
        >{a.is_active ? "停止" : "再開"}</Button>      </div>),
      align: "left"
    },
  ];
  return (<div className={styles.page}>
    <PageHeader
      title="銀行口座マスタ"
      description="法人ごとの銀行口座。仕訳帳の明細取り込みと振込で使います。Ctrl+↑↓ で行移動・Ctrl+Enter で編集。"
      actions={<FilterRow style={{
        display: "flex",
        gap: 8
      }}>        <ChoiceFilter
          label="法人"
          value={filterCompany}
          onValueChange={value => setFilterCompany(value)}
        >          <option value="">すべての法人</option>          {companies.map((c) => <option key={c.id} value={c.id}>{c.name_short}</option>)}        </ChoiceFilter>        <Button
          onClick={() => setEditTarget(empty(companies[0]?.id ?? ""))}
          disabled={companies.length === 0 || !canWrite}
          title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}
        >+ 新規追加</Button>      </FilterRow>}
    />    {error && !editTarget && <div role="alert" style={{
      background: colors.dangerBg,
      color: colors.danger,
      padding: "8px 12px",
      borderRadius: 4,
      marginBottom: 12,
      fontSize: 13
    }}>{error}</div>}    {loading ? <div style={{
      color: colors.textMuted,
      padding: 40,
      textAlign: "center"
    }}>読込中...</div> : mobile ? <div className={styles.cards} aria-label="銀行口座一覧">
      {filtered.length === 0 && <p>データがありません</p>}
      {filtered.map((a, index) => <article key={a.id} className={styles.card} data-active={activeIndex === index || undefined}>
        <button type="button" className={styles.cardBody} disabled={!canWrite}
          aria-label={`${companyMap.get(a.corp_code)?.name_short ?? a.corp_code} ${a.bank_name} ${a.account_number}を編集`}
          onClick={() => setEditTarget(a)}>
          <span className={styles.cardHeading}><span>{companyMap.get(a.corp_code)?.name_short ?? a.corp_code}</span><StatusBadge active={a.is_active} /></span>
          <span>{a.bank_name} <span className={styles.branch}>{[a.branch_name, a.branch_code].filter(Boolean).join(" / ")}</span></span>
          <span className={styles.number}>{a.account_type} <span {...CLARITY_MASK}>{a.account_number}</span></span>
          <span className={styles.cardLabel}>{columns.find(column => column.key === "sub")!.render(a)}</span>
        </button>
        <div className={styles.cardActions}>{columns.find(column => column.key === "actions")!.render(a)}</div>
      </article>)}
    </div> : <div className={styles.table}><DataTable
      columns={columns}
      rows={filtered}
      activeIndex={activeIndex}
      onRowClick={canWrite ? setEditTarget : undefined}
    /></div>}    <Modal
      open={!!editTarget}
      onClose={() => setEditTarget(null)}
      onSubmit={handleSave}
      title={editTarget?.id ? "銀行口座を編集" : "銀行口座を追加"}
      width={720}
    >      {editTarget && (<div>        <div className={styles.formGrid}>          <SelectField
            label="法人"
            required
            disabled={!!editTarget.id}
            value={editTarget.corp_code}
            onChange={e => setEditTarget({
              ...editTarget,
              corp_code: e.target.value
            })}
            error={errors.corp_code}
          >
            {companies.map(c => <option key={c.id} value={c.id}>{c.name_short}</option>)}
          </SelectField>
          <SelectField
            label="銀行"
            required
            disabled={!!editTarget.id}
            value={editTarget.bank_code}
            onChange={e => {
              const bank = BANKS.find(b => b.code === e.target.value)!;
              setEditTarget({
                ...editTarget,
                bank_code: bank.code,
                bank_name: bank.name
              });
            }}
            error={errors.bank_code}
          >
            {BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
          </SelectField>
          <TextField
            label="口座番号"
            required
            disabled={!!editTarget.id}
            {...CLARITY_MASK}
            inputMode="numeric"
            value={editTarget.account_number}
            onChange={e => setEditTarget({
              ...editTarget,
              account_number: e.target.value
            })}
            error={errors.account_number}
          />
          {editTarget.id && <p className={`${styles.help} ${styles.fullWidth}`}>取り込んだ明細と仕訳がこの口座に結びついているため変えられません。変わったときは新しく追加して、古い口座を停止してください。</p>}
          <TextField
            label="支店名"
            value={editTarget.branch_name ?? ""}
            onChange={e => setEditTarget({
              ...editTarget,
              branch_name: e.target.value
            })}
          />
          <TextField
            label="支店コード（3桁）"
            maxLength={3}
            value={editTarget.branch_code ?? ""}
            onChange={e => setEditTarget({
              ...editTarget,
              branch_code: e.target.value
            })}
            error={errors.branch_code}
          />
          <SelectField
            label="口座種別"
            value={editTarget.account_type}
            onChange={e => setEditTarget({
              ...editTarget,
              account_type: e.target.value
            })}
            error={errors.account_type}
          >{ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}</SelectField>
          <div className={styles.withHelp}>
            <TextField
              label="弥生の補助科目名"
              value={editTarget.sub_account_label ?? ""}
              onChange={e => setEditTarget({
                ...editTarget,
                sub_account_label: e.target.value
              })}
            />
            <p className={styles.help}>弥生会計の補助科目名と同じにします。仕訳の書き出しで使います。</p>
          </div>
          <div>
            <span className={styles.fieldHeading}>明細の取り込み</span>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={editTarget.has_csv_export}
                onChange={e => setEditTarget({
                  ...editTarget,
                  has_csv_export: e.target.checked
                })}
              />
              CSV で明細を取り込める
            </label>
            <p className={styles.help}>仕訳帳で銀行の CSV を読み込む口座</p>
          </div>
          <div>
            <span className={styles.fieldHeading}>残高の入力</span>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={editTarget.needs_manual_balance}
                onChange={e => setEditTarget({
                  ...editTarget,
                  needs_manual_balance: e.target.checked
                })}
              />
              残高を手で入れる
            </label>
            <p className={styles.help}>CSV が出せず、残高を手で入れる口座</p>
          </div>
          <TextField
            label="メモ"
            value={editTarget.notes ?? ""}
            onChange={e => setEditTarget({
              ...editTarget,
              notes: e.target.value
            })}
          />
        </div>        {error && <div role="alert" style={{
          background: colors.dangerBg,
          color: colors.danger,
          padding: "8px 12px",
          borderRadius: 4,
          marginTop: 16,
          fontSize: 13
        }}>{error}</div>}
        <div style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          marginTop: 16,
          borderTop: `1px solid ${colors.border}`,
          paddingTop: 16
        }}>          <Button
            variant="secondary"
            onClick={() => setEditTarget(null)}
            disabled={saving}
          >キャンセル</Button>          <Button
            onClick={handleSave}
            disabled={saving || !canWrite}
            title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}
          >{saving ? "保存中..." : "保存"}</Button>        </div>      </div>      )}    </Modal>  </div>);
}
