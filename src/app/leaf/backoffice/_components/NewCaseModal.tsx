"use client";

/**
 * Garden-Leaf 関電業務委託 — 新規案件登録モーダル（Phase A-1b）
 *
 * 対応済み:
 *   - 取得区分（🎯 奪還 / 🔁 囲込）— スマホPoCのアイコンに統一
 *   - 営業担当（社員番号/氏名/部署/アポコード）— ログイン情報から自動補完、手動変更可
 *   - お客様情報（番号/氏名/供給地点22桁）
 *   - PD情報（新PD + 任意の旧PD）
 *   - フラグ（至急SW / 諸元同時提出）
 *   - 備考
 *
 * 案件種別（latest/replaced/makinaoshi/outside）は入力内容から自動判定。
 * スマホUIと同様、ユーザーは選択しない（inferCaseType 参照）
 *
 * 自動設定:
 *   - case_id: 今日の日付ベースで連番生成
 *   - status: "ordered" (受注)
 *   - ordered_at: 今日
 *   - submitted_by: ログイン中ユーザーID
 *   - submitted_at: now
 *   - supply_schedule_code: supply_point_22 の 4〜5文字目から抽出
 *
 * 未実装（Phase A-1c で対応）:
 *   - 添付ファイル（電灯/動力/ガス/諸元/受領書）— Supabase Storage 連携
 *   - OCR 連動・3者比較（将来）
 *   - company_id 自動判定（現在は COMP-001 固定）
 */

import { useState, useEffect } from "react";
import { colors } from "../../_constants/colors";
import { createCase, generateCaseId, fetchEmployeeByNumber } from "../../_lib/queries";
import { getUser } from "../../_lib/auth";
import type { KandenCase } from "../../_lib/types";

// フォールバック: root_employees から company_id を取得できない時の既定値
const FALLBACK_COMPANY_ID = "COMP-001";

type CaseType = KandenCase["case_type"];
type AcquisitionType = KandenCase["acquisition_type"];

const ACQ_TYPE_OPTIONS: { value: AcquisitionType; label: string; desc: string }[] = [
  { value: "dakkan", label: "🎯 奪還", desc: "他電力→関電へ乗り換え" },
  { value: "kakoi",  label: "🔁 囲込", desc: "関電利用中のプラン変更" },
];

/**
 * 入力内容から案件種別を自動判定
 * スマホUIと同様、ユーザーは案件種別を選択しない（自動決定）
 *
 *   - 旧PD番号あり → replaced (置換)
 *   - PDなし & お客様番号手入力 → outside (リスト外)
 *   - それ以外 → latest (最新)
 *   - makinaoshi（巻き直し）は PD マスタ照合が必要なので OCR 連動フェーズで対応
 */
function inferCaseType(input: {
  pdNumber: string;
  oldPdNumber: string;
  customerNumber: string;
}): CaseType {
  if (input.oldPdNumber.trim()) return "replaced";
  if (!input.pdNumber.trim() && input.customerNumber.trim()) return "outside";
  return "latest";
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function NewCaseModal({ onClose, onCreated }: Props) {
  const [acqType, setAcqType] = useState<AcquisitionType>("dakkan");

  // 営業担当（ログイン情報から自動補完・手動変更可）
  const [salesEmpNumber, setSalesEmpNumber] = useState("");
  const [salesName, setSalesName] = useState("");
  const [salesDepartment, setSalesDepartment] = useState("");
  const [appCode, setAppCode] = useState("");

  const [customerNumber, setCustomerNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [supplyPoint22, setSupplyPoint22] = useState("");
  const [pdNumber, setPdNumber] = useState("");
  const [oldPdNumber, setOldPdNumber] = useState("");
  const [isUrgentSw, setIsUrgentSw] = useState(false);
  const [specsReady, setSpecsReady] = useState(false);
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string>(FALLBACK_COMPANY_ID);
  const [autoFillStatus, setAutoFillStatus] = useState<"loading" | "done" | "failed">("loading");

  // ログイン中ユーザーの情報を取得（submitted_by + 営業担当自動補完）
  useEffect(() => {
    (async () => {
      const user = await getUser();
      if (!user) {
        setAutoFillStatus("failed");
        return;
      }
      setUserId(user.id);

      // メールアドレス "emp0008@garden.internal" → "0008"
      const m = user.email?.match(/^emp(\d+)@/);
      if (!m) {
        setAutoFillStatus("failed");
        return;
      }
      const empNum = m[1];
      setSalesEmpNumber(empNum);

      // root_employees から氏名・company_id を引く（RLSで弾かれたら失敗扱い）
      const emp = await fetchEmployeeByNumber(empNum);
      if (emp) {
        setSalesName(emp.name ?? "");
        if (emp.company_id) setCompanyId(emp.company_id);
        setAutoFillStatus("done");
      } else {
        setAutoFillStatus("failed");
      }
    })();
  }, []);

  // ESCキーで閉じる
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function validate(): string | null {
    if (!customerNumber.trim()) return "お客様番号は必須です";
    if (supplyPoint22 && supplyPoint22.length !== 22) {
      return "供給地点番号は22桁で入力してください（空欄可）";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const caseId = await generateCaseId();
      const now = new Date().toISOString();
      const today = now.slice(0, 10); // YYYY-MM-DD

      // 供給地点の上5桁から schedule_code を推定（06XXX の XXX部分を切り出し）
      let scheduleCode: string | null = null;
      if (supplyPoint22.length === 22) {
        scheduleCode = supplyPoint22.slice(3, 5);
      }

      // 案件種別を自動判定（スマホUIと同様、ユーザーは選択しない）
      const caseType = inferCaseType({
        pdNumber,
        oldPdNumber,
        customerNumber,
      });

      const payload: Omit<KandenCase, "created_at" | "updated_at"> = {
        case_id: caseId,
        company_id: companyId,
        case_type: caseType,
        acquisition_type: acqType,

        sales_employee_number: salesEmpNumber.trim() || null,
        sales_name: salesName.trim() || null,
        sales_department: salesDepartment.trim() || null,
        app_code: appCode.trim() || null,

        customer_number: customerNumber.trim(),
        customer_name: customerName.trim() || null,
        supply_point_22: supplyPoint22.trim() || null,
        supply_schedule_code: scheduleCode,
        supply_start_date: null,

        pd_number: pdNumber.trim() || null,
        old_pd_number: oldPdNumber.trim() || null,

        status: "ordered",
        ordered_at: today,
        specs_collected_at: specsReady ? today : null,
        entered_at: null,
        sent_at: null,
        invoiced_at: null,
        payment_received_at: null,
        payment_sent_at: null,
        completed_at: null,

        is_urgent_sw: isUrgentSw,
        sw_target_month: null,
        is_direct_operation: false,
        specs_ready_on_submit: specsReady,

        ocr_status: "pending",
        ocr_customer_number: null,
        ocr_confidence: null,

        compare_customer_name_result: null,
        compare_address_result: null,
        compare_supply_point_result: null,

        review_note: null,
        submitted_by: userId,
        submitted_at: now,
        note: note.trim() || null,
      };

      await createCase(payload);
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 10000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 20px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.bgCard,
          borderRadius: 12,
          width: "100%",
          maxWidth: 680,
          padding: "24px 28px 28px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
        }}
      >
        {/* ヘッダー */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>
            ＋ 新規案件登録
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              color: colors.textMuted,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 20 }}>
          受注時の基本情報を入力します。添付ファイル・OCR連携は後続フェーズで対応。
        </div>

        <form onSubmit={handleSubmit}>
          {/* 取得区分 */}
          <Section title="取得区分">
            <RadioGroup
              name="acq_type"
              value={acqType}
              options={ACQ_TYPE_OPTIONS}
              onChange={(v) => setAcqType(v as AcquisitionType)}
            />
          </Section>

          {/* 営業担当（自動補完・編集可） */}
          <Section title="営業担当">
            <div
              style={{
                fontSize: 11,
                color:
                  autoFillStatus === "done"
                    ? colors.success
                    : autoFillStatus === "failed"
                      ? colors.warning
                      : colors.textMuted,
                marginBottom: 8,
              }}
            >
              {autoFillStatus === "loading" && "ログイン情報を読込中..."}
              {autoFillStatus === "done" && "✓ ログイン情報から自動入力しました（変更可）"}
              {autoFillStatus === "failed" && "⚠ 自動入力に失敗。手動入力してください"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="社員番号">
                <input
                  type="text"
                  value={salesEmpNumber}
                  onChange={(e) => setSalesEmpNumber(e.target.value)}
                  placeholder="例: 0008"
                  style={inputStyle}
                />
              </Field>
              <Field label="氏名">
                <input
                  type="text"
                  value={salesName}
                  onChange={(e) => setSalesName(e.target.value)}
                  placeholder="例: 東海林 美琴"
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="部署">
                <input
                  type="text"
                  value={salesDepartment}
                  onChange={(e) => setSalesDepartment(e.target.value)}
                  placeholder="（任意）"
                  style={inputStyle}
                />
              </Field>
              <Field label="アポコード">
                <input
                  type="text"
                  value={appCode}
                  onChange={(e) => setAppCode(e.target.value)}
                  placeholder="（任意）"
                  style={inputStyle}
                />
              </Field>
            </div>
          </Section>

          {/* お客様情報 */}
          <Section title="お客様情報">
            <Field label="お客様番号 *" required>
              <input
                type="text"
                inputMode="numeric"
                value={customerNumber}
                onChange={(e) => setCustomerNumber(e.target.value)}
                placeholder="14桁（例: 12345678901234）"
                style={inputStyle}
                autoFocus
              />
            </Field>
            <Field label="お客様氏名">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="山田 太郎（任意）"
                style={inputStyle}
              />
            </Field>
            <Field label="供給地点番号 (22桁)">
              <input
                type="text"
                inputMode="numeric"
                value={supplyPoint22}
                onChange={(e) => setSupplyPoint22(e.target.value.replace(/\D/g, "").slice(0, 22))}
                placeholder="0600012345678901234567（任意）"
                style={{ ...inputStyle, fontFamily: "ui-monospace, monospace", letterSpacing: 1 }}
              />
              {supplyPoint22 && supplyPoint22.length !== 22 && (
                <div style={{ fontSize: 11, color: colors.warning, marginTop: 4 }}>
                  {supplyPoint22.length}桁入力中（22桁まで）
                </div>
              )}
            </Field>
          </Section>

          {/* PD情報 */}
          <Section title="PD情報">
            <Field label="PD番号">
              <input
                type="text"
                value={pdNumber}
                onChange={(e) => setPdNumber(e.target.value)}
                placeholder="新PD番号（任意）"
                style={inputStyle}
              />
            </Field>
            <Field label="旧PD番号（置換時のみ）">
              <input
                type="text"
                value={oldPdNumber}
                onChange={(e) => setOldPdNumber(e.target.value)}
                placeholder="置換前のPD番号（任意・入力すると「置換」案件として登録されます）"
                style={inputStyle}
              />
            </Field>
          </Section>

          {/* フラグ */}
          <Section title="フラグ">
            <Checkbox
              label="🔴 至急SW案件（急ぎ対応）"
              checked={isUrgentSw}
              onChange={setIsUrgentSw}
            />
            <Checkbox
              label="📎 諸元も一緒に提出済み（= 諸元待ちをスキップ）"
              checked={specsReady}
              onChange={setSpecsReady}
            />
          </Section>

          {/* 備考 */}
          <Section title="備考">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="特記事項・引き継ぎメモ等（任意）"
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
                minHeight: 64,
                fontFamily: "inherit",
              }}
            />
          </Section>

          {error && (
            <div
              style={{
                background: colors.dangerBg,
                color: colors.danger,
                padding: "10px 12px",
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {/* アクションボタン */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: "10px 20px",
                borderRadius: 6,
                border: `1.5px solid ${colors.border}`,
                background: "#fff",
                color: colors.text,
                fontSize: 14,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "10px 24px",
                borderRadius: 6,
                border: "none",
                background: submitting ? colors.textMuted : colors.accent,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "登録中..." : "登録する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── サブコンポーネント ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 10,
          borderBottom: `1px solid ${colors.borderLight}`,
          paddingBottom: 4,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: required ? colors.text : colors.textMuted,
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function RadioGroup<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string; desc: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <label
            key={o.value}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              padding: "8px 10px",
              borderRadius: 6,
              border: `1.5px solid ${active ? colors.accent : colors.border}`,
              background: active ? colors.accentLight : "#fff",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name={name}
                checked={active}
                onChange={() => onChange(o.value)}
                style={{ margin: 0, accentColor: colors.accent }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: active ? colors.accent : colors.text }}>
                {o.label}
              </span>
            </span>
            <span style={{ fontSize: 10, color: colors.textMuted, marginLeft: 20 }}>
              {o.desc}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 0",
        cursor: "pointer",
        fontSize: 13,
        color: colors.text,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: colors.accent }}
      />
      <span>{label}</span>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 6,
  border: `1.5px solid ${colors.border}`,
  fontSize: 14,
  color: colors.text,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};
