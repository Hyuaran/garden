"use client";

/**
 * Garden-Forest サマリーカード（5枚）
 *
 * 最新確定期のデータを集計して表示。
 * v9 の renderSummary() を React コンポーネント化。
 */

import { useMemo } from "react";

import type { Company, FiscalPeriod } from "../_constants/companies";
import { FOREST_THEME } from "../_constants/theme";
import { fmtYen } from "../_lib/format";

type Props = {
  companies: Company[];
  periods: FiscalPeriod[];
};

type CardData = {
  label: string;
  value: string;
  sub: string;
};

export function SummaryCards({ companies, periods }: Props) {
  const cards = useMemo<CardData[]>(() => {
    let totalU = 0;
    let totalR = 0;
    let totalJ = 0;
    let totalGY = 0;
    let countWithData = 0;

    companies.forEach((c) => {
      const compPeriods = periods
        .filter((p) => p.company_id === c.id)
        .sort((a, b) => a.ki - b.ki);
      if (compPeriods.length === 0) return;
      const last = compPeriods[compPeriods.length - 1];
      totalU += last.uriage ?? 0;
      totalR += last.rieki ?? 0;
      totalJ += last.junshisan ?? 0;
      totalGY += (last.genkin ?? 0) + (last.yokin ?? 0);
      countWithData++;
    });

    return [
      { label: "総売上高", value: fmtYen(totalU), sub: `${countWithData}社合算` },
      { label: "経常利益", value: fmtYen(totalR), sub: "営業外損益を含む" },
      { label: "純資産", value: fmtYen(totalJ), sub: "総資産 − 総負債" },
      { label: "現預金", value: fmtYen(totalGY), sub: "手許現金 + 銀行預金" },
      {
        label: "法人数",
        value: `${companies.length}社`,
        sub: `${countWithData}社データあり`,
      },
    ];
  }, [companies, periods]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16,
        marginBottom: 32,
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            background: FOREST_THEME.panelBg,
            backdropFilter: "blur(20px)",
            border: `1px solid ${FOREST_THEME.panelBorder}`,
            borderRadius: FOREST_THEME.panelRadius,
            padding: "20px 24px",
            boxShadow: FOREST_THEME.panelShadow,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: FOREST_THEME.textMuted,
              marginBottom: 4,
            }}
          >
            {card.label}
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: FOREST_THEME.textPrimary,
              marginBottom: 4,
            }}
          >
            {card.value}
          </div>
          <div style={{ fontSize: 11, color: FOREST_THEME.textSecondary }}>
            {card.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
