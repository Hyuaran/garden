/**
 * Garden-Bud / Phase D #06 年末調整連携 純関数
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-06-nenmatsu-integration.md
 *
 * 純関数のみ。Server Action / Cron は集計済データを渡して呼ぶ。
 *
 * 範囲:
 *   - calculateAnnualWithheld: 月次累計集計（11 月まで + 12 月予定 + 賞与）
 *   - calculateSettlement: 年税額 - 既徴収累計 → settlement_amount + type
 *   - classifySettlementType: refund / additional / zero
 *   - applySettlementToSalary: 1 月給与に精算反映（純計算）
 *   - validateSettlementWarnings: 還付過大 / 追徴過大の警告生成
 *   - planInstallments: 追徴の分割提案（最長 12 ヶ月、spec §11.5）
 */

import {
  type AnnualWithheldSummary,
  type ApplySettlementInput,
  type ApplySettlementResult,
  type InstallmentPlanInput,
  type InstallmentPlanResult,
  type InstallmentPlanItem,
  type MonthlyWithheldRecord,
  type SettlementInput,
  type SettlementResult,
  type SettlementType,
  type SettlementWarning,
  type SettlementWarningCode,
} from "./nenmatsu-types";

// ============================================================
// 1. calculateAnnualWithheld（月次源泉徴収簿の集計）
// ============================================================

/**
 * 月次源泉徴収簿レコードから年間累計を集計する純関数。
 *
 * - 11 月までの月次合計 → totalWithheldToNovember
 * - 12 月の月次 → decemberSalaryWithheld（精算月とは別、月次源泉のみ）
 * - 賞与（period_type='bonus'）→ bonusWithheldTotal
 *
 * 入力レコードは fiscal_year + employee_id でフィルタ済前提。
 */
export function calculateAnnualWithheld(
  records: readonly MonthlyWithheldRecord[],
  fiscalYear: number,
  employeeId: string,
): AnnualWithheldSummary {
  const filtered = records.filter(
    (r) => r.fiscalYear === fiscalYear && r.employeeId === employeeId,
  );

  let totalWithheldToNovember = 0;
  let decemberSalaryWithheld = 0;
  let bonusWithheldTotal = 0;
  let totalGrossPay = 0;
  let totalSocialInsurance = 0;
  let monthlyRecordCount = 0;
  let bonusRecordCount = 0;

  for (const r of filtered) {
    totalGrossPay += r.grossPay;
    totalSocialInsurance += r.socialInsuranceTotal;

    if (r.periodType === "bonus") {
      bonusWithheldTotal += r.withholdingTax;
      bonusRecordCount += 1;
      continue;
    }

    // monthly: paymentDate の月で 11 月以下 / 12 月で振り分け
    const month = parseMonthFromIso(r.paymentDate);
    if (month <= 11) {
      totalWithheldToNovember += r.withholdingTax;
    } else if (month === 12) {
      decemberSalaryWithheld += r.withholdingTax;
    }
    // 1 月（fiscalYear+1 の月次扱い、本集計対象外）はスキップ
    monthlyRecordCount += 1;
  }

  return {
    fiscalYear,
    employeeId,
    totalWithheldToNovember,
    decemberSalaryWithheld,
    bonusWithheldTotal,
    totalGrossPay,
    totalSocialInsurance,
    monthlyRecordCount,
    bonusRecordCount,
  };
}

/**
 * ISO 日付文字列（YYYY-MM-DD）から月（1〜12）を抽出。
 */
function parseMonthFromIso(isoDate: string): number {
  // 'YYYY-MM-DD' 想定。'YYYY-MM-DDTHH:mm:ss' も許容。
  const m = isoDate.slice(5, 7);
  const month = Number.parseInt(m, 10);
  if (Number.isNaN(month) || month < 1 || month > 12) {
    throw new Error(`Invalid ISO date for month parse: ${isoDate}`);
  }
  return month;
}

// ============================================================
// 2. classifySettlementType
// ============================================================

/**
 * 精算金額の符号から精算タイプを分類。
 *
 * - 正値: additional（追徴）
 * - 負値: refund（還付）
 * - 0: zero
 */
export function classifySettlementType(amount: number): SettlementType {
  if (amount > 0) return "additional";
  if (amount < 0) return "refund";
  return "zero";
}

// ============================================================
// 3. calculateSettlement
// ============================================================

/**
 * 年税額と既徴収累計から精算額を計算。
 *
 * settlement_amount = annualTaxAmount - totalWithheld
 *   - 正値: annualTaxAmount > 既徴収（不足）→ 追徴
 *   - 負値: annualTaxAmount < 既徴収（過納）→ 還付
 *
 * 精度: 円単位（小数点以下切り捨て）。
 */
export function calculateSettlement(input: SettlementInput): SettlementResult {
  const totalWithheld =
    input.totalWithheldToNovember +
    input.decemberSalaryWithheld +
    input.bonusWithheldTotal;

  const rawAmount = input.annualTaxAmount - totalWithheld;
  // 円単位（spec の numeric(10, 0)）。Math.trunc で 0 方向に丸める。
  // Math.trunc(-0.x) は -0 を返すため +0 へ正規化（DB 比較・等価判定の安定化）。
  const truncated = Math.trunc(rawAmount);
  const settlementAmount = truncated === 0 ? 0 : truncated;

  return {
    fiscalYear: input.fiscalYear,
    employeeId: input.employeeId,
    annualTaxAmount: input.annualTaxAmount,
    totalWithheld,
    settlementAmount,
    settlementType: classifySettlementType(settlementAmount),
  };
}

// ============================================================
// 4. applySettlementToSalary（1 月給与への精算反映、spec §5.2）
// ============================================================

/**
 * 1 月給与計算時に承認済 settlement を反映する純関数。
 *
 * spec §10 判 7: 月次源泉徴収を先に計算 → settlement_amount を加減算。
 * withholding_tax は月次のまま、精算は別欄で表示する設計。
 *
 * 数式:
 *   settlementAdjustment = settlementAmount  // 正=追徴控除追加 / 負=還付給与プラス
 *   finalWithholding = januaryNormalWithholding + settlementAdjustment
 *   finalTotalDeductions = januaryTotalDeductions - januaryNormalWithholding + finalWithholding
 *   finalNetPay = januaryGrossPay - finalTotalDeductions
 */
export function applySettlementToSalary(
  input: ApplySettlementInput,
): ApplySettlementResult {
  const settlementAdjustment = input.settlementAmount;
  const finalWithholding =
    input.januaryNormalWithholding + settlementAdjustment;
  const finalTotalDeductions =
    input.januaryTotalDeductions -
    input.januaryNormalWithholding +
    finalWithholding;
  const finalNetPay = input.januaryGrossPay - finalTotalDeductions;

  return {
    januaryNormalWithholding: input.januaryNormalWithholding,
    settlementAdjustment,
    finalWithholding,
    finalTotalDeductions,
    finalNetPay,
  };
}

// ============================================================
// 5. validateSettlementWarnings（spec §11.4 反映）
// ============================================================

/**
 * 精算反映時の警告生成。
 *
 * 警告条件（spec §5.3 / §5.4 / §11.4 反映）:
 *   - 還付額 > gross の 20% → REFUND_EXCESS_GROSS_20PCT (warning)
 *   - 還付額 > gross の 30% → REFUND_EXCESS_GROSS_30PCT (error)
 *   - 追徴で net_pay マイナス → ADDITIONAL_EXCESS_NET_PAY (error) + INSTALLMENT_RECOMMENDED
 *   - 追徴額 > gross の 30% → ADDITIONAL_LARGE_30PCT (warning) + INSTALLMENT_RECOMMENDED
 */
export function validateSettlementWarnings(
  settlementResult: SettlementResult,
  applyResult: ApplySettlementResult,
  januaryGrossPay: number,
): SettlementWarning[] {
  const warnings: SettlementWarning[] = [];
  const absSettlement = Math.abs(settlementResult.settlementAmount);
  const ratio = januaryGrossPay > 0 ? absSettlement / januaryGrossPay : 0;

  // refund 警告（spec §11.4 改訂で 20% に引き下げ検討、本実装は 20% / 30% 両方）
  if (settlementResult.settlementType === "refund") {
    if (ratio > 0.3) {
      warnings.push(
        buildWarning(
          "REFUND_EXCESS_GROSS_30PCT",
          "warning",
          `還付額 ${absSettlement} 円 が 1 月給与 gross の 30% を超えます（${(ratio * 100).toFixed(1)}%）。控除申告書の入力誤りの可能性あり。`,
        ),
      );
    } else if (ratio > 0.2) {
      warnings.push(
        buildWarning(
          "REFUND_EXCESS_GROSS_20PCT",
          "warning",
          `還付額 ${absSettlement} 円 が 1 月給与 gross の 20% を超えます（${(ratio * 100).toFixed(1)}%）。`,
        ),
      );
    }
  }

  // additional 警告
  if (settlementResult.settlementType === "additional") {
    if (applyResult.finalNetPay < 0) {
      warnings.push(
        buildWarning(
          "ADDITIONAL_EXCESS_NET_PAY",
          "error",
          `追徴 ${absSettlement} 円 で 1 月手取りがマイナス（${applyResult.finalNetPay} 円）になります。分割徴収を必須とします。`,
        ),
      );
      warnings.push(
        buildWarning(
          "INSTALLMENT_RECOMMENDED",
          "info",
          `分割徴収プランを作成してください（最長 12 ヶ月、spec §11.5）。`,
        ),
      );
    } else if (ratio > 0.3) {
      warnings.push(
        buildWarning(
          "ADDITIONAL_LARGE_30PCT",
          "warning",
          `追徴額 ${absSettlement} 円 が 1 月給与 gross の 30% を超えます（${(ratio * 100).toFixed(1)}%）。`,
        ),
      );
      warnings.push(
        buildWarning(
          "INSTALLMENT_RECOMMENDED",
          "info",
          `分割徴収プランの作成を推奨します。`,
        ),
      );
    }
  }

  return warnings;
}

function buildWarning(
  code: SettlementWarningCode,
  severity: SettlementWarning["severity"],
  message: string,
): SettlementWarning {
  return { code, severity, message };
}

// ============================================================
// 6. planInstallments（分割提案、spec §11.5、最長 12 ヶ月）
// ============================================================

/**
 * 追徴額の分割プランを生成。
 *
 * monthlyMaxAmount 指定時は 1 ヶ月あたり上限を超えないよう均等分配 + 端数調整。
 * 12 ヶ月超になる場合は exceedsMaxMonths=true で警告（運用判断）。
 *
 * startMonth: 通常 1（翌年 1 月給与から開始）。
 */
export function planInstallments(
  input: InstallmentPlanInput,
): InstallmentPlanResult {
  if (input.totalAmount <= 0) {
    return {
      totalAmount: input.totalAmount,
      installments: [],
      totalMonths: 0,
      exceedsMaxMonths: false,
    };
  }

  const maxPerMonth = input.monthlyMaxAmount ?? input.totalAmount;
  if (maxPerMonth <= 0) {
    throw new Error("monthlyMaxAmount must be > 0 when specified");
  }

  // 必要月数（切り上げ）
  const neededMonths = Math.ceil(input.totalAmount / maxPerMonth);
  // 12 ヶ月上限（spec §11.5 / 判 2）
  const totalMonths = Math.min(neededMonths, 12);
  const exceedsMaxMonths = neededMonths > 12;

  const installments: InstallmentPlanItem[] = [];
  let remaining = input.totalAmount;

  for (let i = 0; i < totalMonths; i++) {
    const monthNumber = ((input.startMonth - 1 + i) % 12) + 1;
    const fiscalYearOfPayment =
      input.fiscalYear + Math.floor((input.startMonth - 1 + i) / 12);

    let amount: number;
    if (i === totalMonths - 1) {
      // 最終月で残額を全額（端数調整）
      amount = remaining;
    } else {
      // 等分（円単位、Math.floor で切り捨て）
      amount = Math.min(
        Math.floor(input.totalAmount / totalMonths),
        maxPerMonth,
      );
    }

    installments.push({
      monthNumber,
      fiscalYearOfPayment,
      amount,
    });
    remaining -= amount;
  }

  return {
    totalAmount: input.totalAmount,
    installments,
    totalMonths,
    exceedsMaxMonths,
  };
}

// ============================================================
// 7. shouldExcludeFromSettlement（退職者判定、spec §2.1 / §11.5）
// ============================================================

/**
 * 当年中に退職した従業員は 1 月精算対象外（最終給与で即時精算済）。
 *
 * 判定:
 *   - deleted_at が当年内 → 退職扱い（excludedReason='retired_in_year'）
 *   - deleted_at が翌年以降 or NULL → 在籍扱い（settlement 対象）
 */
export function shouldExcludeFromSettlement(
  fiscalYear: number,
  employeeDeletedAt: string | null,
): { excluded: boolean; reason: "retired_in_year" | null } {
  if (!employeeDeletedAt) {
    return { excluded: false, reason: null };
  }

  const deletedYear = parseYearFromIso(employeeDeletedAt);
  if (deletedYear === fiscalYear) {
    return { excluded: true, reason: "retired_in_year" };
  }

  return { excluded: false, reason: null };
}

function parseYearFromIso(iso: string): number {
  const y = iso.slice(0, 4);
  const year = Number.parseInt(y, 10);
  if (Number.isNaN(year)) {
    throw new Error(`Invalid ISO timestamp for year parse: ${iso}`);
  }
  return year;
}

// ============================================================
// 8. validateMyNumberFormat（マイナンバー形式バリデーション、暗号化前のチェック）
// ============================================================

/**
 * マイナンバー（個人番号）の形式バリデーション。
 *
 * - 12 桁数字
 * - チェックデジット検証（行政手続番号利用法施行令 第 8 条）
 *
 * 注意: 本関数は形式バリデーションのみ。暗号化保管は SQL 関数 bud_encrypt_my_number 経由。
 */
export function validateMyNumberFormat(myNumber: string): {
  valid: boolean;
  error?: string;
} {
  if (!/^[0-9]{12}$/.test(myNumber)) {
    return { valid: false, error: "マイナンバーは 12 桁数字" };
  }

  // チェックデジット検証
  // 上 11 桁 × 重み (6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2) の合計を 11 で割った余りで判定。
  const weights = [6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += Number.parseInt(myNumber[i], 10) * weights[i];
  }
  const remainder = sum % 11;
  const expectedCheckDigit = remainder <= 1 ? 0 : 11 - remainder;
  const actualCheckDigit = Number.parseInt(myNumber[11], 10);

  if (expectedCheckDigit !== actualCheckDigit) {
    return { valid: false, error: "チェックデジット不一致" };
  }

  return { valid: true };
}
