"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "../_components/PageHeader";
import { Button } from "../_components/Button";
import { DataTable, Column } from "../_components/DataTable";
import { StatusBadge } from "../_components/StatusBadge";
import { Modal } from "../_components/Modal";
import { TextField, SelectField, FormGrid } from "../_components/FormField";
import {
  fetchCompanies,
  upsertCompany,
  setCompanyActive,
} from "../_lib/queries";
import type { Company } from "../_constants/types";
import { DEFAULT_BANKS } from "../_constants/types";
import { colors } from "../_constants/colors";
import { useRootState } from "../_state/RootStateContext";
import { writeAudit } from "../_lib/audit";
import {
  validateCompany,
  hasErrors,
  VALIDATION_ERROR_BANNER,
  type FieldErrors,
} from "../_lib/validators";
import { useMasterShortcuts } from "../_lib/useMasterShortcuts";
import {
  sanitizeUpsertPayload,
  NULLABLE_DATE_KEYS,
} from "../_lib/sanitize-payload";

const emptyCompany = (nextId: string): Company => ({
  company_id: nextId,
  company_name: "",
  company_name_kana: "",
  corporate_number: null,
  representative: "",
  address: "",
  phone: null,
  fax: null,
  fiscal_end_month: null,
  invoice_registration_number: null,
  telecom_notification_number: null,
  employment_insurance_number: null,
  labor_insurance_number: null,
  tax_office: null,
  agency_notification_number: null,
  industry_classification: null,
  domain: null,
  representative_kana: null,
  representative_gender: null,
  representative_birthday: null,
  representative_address: null,
  representative_mobile: null,
  contact1_name: null,
  contact1_phone: null,
  contact2_name: null,
  contact2_phone: null,
  established_on: null,
  website: null,
  default_bank: "楽天銀行",
  is_active: true,
  created_at: "",
  updated_at: "",
});

function SectionHeading({ children }: { children: string }) {
  return (
    <h3
      style={{
        margin: "20px 0 12px",
        paddingBottom: 6,
        borderBottom: `1px solid ${colors.border}`,
        fontSize: 15,
      }}
    >
      {children}
    </h3>
  );
}

function nextCompanyId(existing: Company[]): string {
  const nums = existing
    .map((c) => parseInt(c.company_id.replace("COMP-", ""), 10))
    .filter((n) => !isNaN(n));
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
  const [errors, setErrors] = useState<FieldErrors>({});

  const { activeIndex } = useMasterShortcuts<Company>({
    rows: companies,
    modalOpen: !!editTarget,
    onEditRow: canWrite ? setEditTarget : undefined,
  });

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

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!editTarget) setErrors({});
  }, [editTarget]);

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
    const errs = validateCompany(editTarget);
    if (hasErrors(errs)) {
      setErrors(errs);
      setError(VALIDATION_ERROR_BANNER);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setErrors({});
      await upsertCompany(
        sanitizeUpsertPayload(editTarget, {
          nullableDateKeys: NULLABLE_DATE_KEYS.companies,
        }) as Partial<Company> & { company_id: string },
      );
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
    { key: "id", header: "ID", render: (c) => c.company_id, width: 100 },
    {
      key: "name",
      header: "法人名",
      render: (c) => c.company_name,
      width: 220,
    },
    {
      key: "kana",
      header: "カナ",
      render: (c) => c.company_name_kana,
      width: 220,
    },
    {
      key: "rep",
      header: "代表者",
      render: (c) => c.representative,
      width: 120,
    },
    {
      key: "bank",
      header: "デフォルト銀行",
      render: (c) => c.default_bank,
      width: 120,
    },
    { key: "phone", header: "電話", render: (c) => c.phone ?? "—" },
    {
      key: "status",
      header: "状態",
      render: (c) => <StatusBadge active={c.is_active} />,
      width: 80,
      align: "center",
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <div
          style={{ display: "flex", gap: 6 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="secondary"
            onClick={() => setEditTarget(c)}
            disabled={!canWrite}
            title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}
          >
            編集
          </Button>
          <Button
            variant={c.is_active ? "danger" : "primary"}
            onClick={() => handleToggleActive(c)}
            disabled={!canWrite}
            title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}
          >
            {c.is_active ? "無効化" : "有効化"}
          </Button>
        </div>
      ),
      width: 170,
      align: "right",
    },
  ];

  return (
    <>
      <PageHeader
        title="法人マスタ"
        description="6法人の基本情報、デフォルト振込銀行。削除不可（無効化で管理）。Ctrl+↑↓ で行移動・Ctrl+Enter で編集。"
        actions={
          <Button
            variant="primary"
            onClick={() =>
              setEditTarget(emptyCompany(nextCompanyId(companies)))
            }
            disabled={!canWrite}
            title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}
          >
            + 新規追加
          </Button>
        }
      />

      {error && (
        <div
          style={{
            background: colors.dangerBg,
            color: colors.danger,
            padding: "8px 12px",
            borderRadius: 4,
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      {loading ? (
        <div
          style={{ color: colors.textMuted, padding: 40, textAlign: "center" }}
        >
          読込中...
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={companies}
          emptyMessage="法人データがありません"
          activeIndex={activeIndex}
          onRowClick={canWrite ? setEditTarget : undefined}
        />
      )}

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={handleSave}
        title={editTarget?.created_at ? "法人を編集" : "法人を追加"}
        width={920}
      >
        {editTarget && (
          <div>
            <SectionHeading>基本</SectionHeading>
            <FormGrid>
              <TextField
                label="法人ID"
                required
                value={editTarget.company_id}
                onChange={(e) =>
                  setEditTarget({ ...editTarget, company_id: e.target.value })
                }
                disabled={!!editTarget.created_at}
                error={errors.company_id}
              />
              <SelectField
                label="デフォルト振込銀行"
                required
                value={editTarget.default_bank}
                onChange={(e) =>
                  setEditTarget({ ...editTarget, default_bank: e.target.value })
                }
                error={errors.default_bank}
              >
                {DEFAULT_BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="法人名"
                required
                value={editTarget.company_name}
                onChange={(e) =>
                  setEditTarget({ ...editTarget, company_name: e.target.value })
                }
                error={errors.company_name}
              />
              <TextField
                label="法人名カナ"
                required
                value={editTarget.company_name_kana}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    company_name_kana: e.target.value,
                  })
                }
                error={errors.company_name_kana}
              />
              <TextField
                label="電話番号"
                value={editTarget.phone ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    phone: e.target.value || null,
                  })
                }
                error={errors.phone}
              />
              <TextField
                label="FAX番号"
                value={editTarget.fax ?? ""}
                onChange={(e) =>
                  setEditTarget({ ...editTarget, fax: e.target.value || null })
                }
                error={errors.fax}
              />
              <SelectField
                label="決算月"
                value={editTarget.fiscal_end_month ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    fiscal_end_month: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                error={errors.fiscal_end_month}
              >
                <option value="">未登録</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>
                    {month}月
                  </option>
                ))}
              </SelectField>
              <TextField
                label="設立日"
                type="date"
                value={editTarget.established_on ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    established_on: e.target.value || null,
                  })
                }
              />
              <TextField
                label="メールドメイン"
                value={editTarget.domain ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    domain: e.target.value || null,
                  })
                }
              />
              <TextField
                label="Webサイト"
                type="url"
                value={editTarget.website ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    website: e.target.value || null,
                  })
                }
              />
            </FormGrid>
            <TextField
              label="本店所在地"
              required
              value={editTarget.address}
              onChange={(e) =>
                setEditTarget({ ...editTarget, address: e.target.value })
              }
              error={errors.address}
            />

            <SectionHeading>番号類</SectionHeading>
            <FormGrid>
              <TextField
                label="法人番号（13桁）"
                value={editTarget.corporate_number ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    corporate_number: e.target.value || null,
                  })
                }
                error={errors.corporate_number}
              />
              <TextField
                label="インボイス登録番号"
                value={editTarget.invoice_registration_number ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    invoice_registration_number: e.target.value || null,
                  })
                }
              />
              <TextField
                label="電気通信事業届出番号"
                value={editTarget.telecom_notification_number ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    telecom_notification_number: e.target.value || null,
                  })
                }
              />
              <TextField
                label="雇用保険事業所番号"
                value={editTarget.employment_insurance_number ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    employment_insurance_number: e.target.value || null,
                  })
                }
              />
              <TextField
                label="労働保険番号"
                value={editTarget.labor_insurance_number ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    labor_insurance_number: e.target.value || null,
                  })
                }
              />
              <TextField
                label="代理店届出番号"
                value={editTarget.agency_notification_number ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    agency_notification_number: e.target.value || null,
                  })
                }
              />
              <TextField
                label="産業分類番号"
                value={editTarget.industry_classification ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    industry_classification: e.target.value || null,
                  })
                }
              />
              <TextField
                label="管轄税務署"
                value={editTarget.tax_office ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    tax_office: e.target.value || null,
                  })
                }
              />
            </FormGrid>

            <SectionHeading>代表者</SectionHeading>
            <FormGrid>
              <TextField
                label="代表者名"
                required
                value={editTarget.representative}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    representative: e.target.value,
                  })
                }
                error={errors.representative}
              />
              <TextField
                label="代表者名カナ"
                value={editTarget.representative_kana ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    representative_kana: e.target.value || null,
                  })
                }
              />
              <SelectField
                label="代表者性別"
                value={editTarget.representative_gender ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    representative_gender: e.target.value || null,
                  })
                }
              >
                <option value="">未登録</option>
                <option value="男性">男性</option>
                <option value="女性">女性</option>
                <option value="その他">その他</option>
              </SelectField>
              <TextField
                label="代表者生年月日"
                type="date"
                value={editTarget.representative_birthday ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    representative_birthday: e.target.value || null,
                  })
                }
              />
              <TextField
                label="代表者携帯番号"
                value={editTarget.representative_mobile ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    representative_mobile: e.target.value || null,
                  })
                }
                error={errors.representative_mobile}
              />
            </FormGrid>
            <TextField
              label="代表者住所"
              value={editTarget.representative_address ?? ""}
              onChange={(e) =>
                setEditTarget({
                  ...editTarget,
                  representative_address: e.target.value || null,
                })
              }
            />

            <SectionHeading>担当者</SectionHeading>
            <FormGrid>
              <TextField
                label="担当者1 氏名"
                value={editTarget.contact1_name ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    contact1_name: e.target.value || null,
                  })
                }
              />
              <TextField
                label="担当者1 電話番号"
                value={editTarget.contact1_phone ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    contact1_phone: e.target.value || null,
                  })
                }
                error={errors.contact1_phone}
              />
              <TextField
                label="担当者2 氏名"
                value={editTarget.contact2_name ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    contact2_name: e.target.value || null,
                  })
                }
              />
              <TextField
                label="担当者2 電話番号"
                value={editTarget.contact2_phone ?? ""}
                onChange={(e) =>
                  setEditTarget({
                    ...editTarget,
                    contact2_phone: e.target.value || null,
                  })
                }
                error={errors.contact2_phone}
              />
            </FormGrid>

            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 16,
                borderTop: `1px solid ${colors.border}`,
                paddingTop: 16,
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setEditTarget(null)}
                disabled={saving}
              >
                キャンセル
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving || !canWrite}
                title={
                  !canWrite ? "編集権限がありません（管理者以上）" : undefined
                }
              >
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
