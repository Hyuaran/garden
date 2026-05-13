/**
 * D-08 テスト戦略 / 源泉徴収月額表 fixture 骨格（甲・乙抜粋）
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-08-test-strategy.md §2.2
 *
 * 国税庁公開「給与所得の源泉徴収税額表（平成 28 年版以降）」抜粋。
 * テスト用の最小サンプル。本番 lookup は DB（bud_withholding_tax_tables_*）参照。
 */

import type {
  WithholdingTaxTableKouRow,
  WithholdingTaxTableOtsuRow,
} from "../../salary-types";

// 甲欄（扶養控除等申告書を提出した者）
// 抜粋: 月額 88,000 円 / 200,000 円 / 300,000 円 / 500,000 円 の各階層
// 1 行に扶養 0〜7 のすべての税額を保持。
export const withholdingKouSample: WithholdingTaxTableKouRow[] = [
  {
    id: "fix-kou-low",
    effectiveYear: 2026,
    taxableMin: 0,
    taxableMax: 88000,
    dependents0: 0,
    dependents1: 0,
    dependents2: 0,
    dependents3: 0,
    dependents4: 0,
    dependents5: 0,
    dependents6: 0,
    dependents7: 0,
  },
  {
    id: "fix-kou-200k",
    effectiveYear: 2026,
    taxableMin: 200000,
    taxableMax: 203000,
    dependents0: 4770,
    dependents1: 3140,
    dependents2: 1530,
    dependents3: 0,
    dependents4: 0,
    dependents5: 0,
    dependents6: 0,
    dependents7: 0,
  },
  {
    id: "fix-kou-300k",
    effectiveYear: 2026,
    taxableMin: 300000,
    taxableMax: 305000,
    dependents0: 8420,
    dependents1: 6740,
    dependents2: 5130,
    dependents3: 3550,
    dependents4: 1980,
    dependents5: 410,
    dependents6: 0,
    dependents7: 0,
  },
  {
    id: "fix-kou-500k",
    effectiveYear: 2026,
    taxableMin: 500000,
    taxableMax: 503000,
    dependents0: 28210,
    dependents1: 25530,
    dependents2: 22860,
    dependents3: 20180,
    dependents4: 17500,
    dependents5: 14820,
    dependents6: 12150,
    dependents7: 9470,
  },
];

// 乙欄（扶養控除等申告書未提出 / 副業）
export const withholdingOtsuSample: WithholdingTaxTableOtsuRow[] = [
  {
    id: "fix-otsu-low",
    effectiveYear: 2026,
    taxableMin: 0,
    taxableMax: 88000,
    taxRate: 0.03063,
    flatAmount: 0,
  },
  {
    id: "fix-otsu-mid",
    effectiveYear: 2026,
    taxableMin: 88000,
    taxableMax: 740000,
    taxRate: 0.08168,
    flatAmount: 0,
  },
  {
    id: "fix-otsu-high",
    effectiveYear: 2026,
    taxableMin: 740000,
    taxableMax: 1700000,
    taxRate: 0.20422,
    flatAmount: 0,
  },
];
