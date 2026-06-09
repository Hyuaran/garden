"use client";

/**
 * Garden-Forest サマリーカード（5枚）
 *
 * 最新確定期のデータを集計して表示。
 * v9 の renderSummary() を React コンポーネント化。
 */

import { useMemo } from "react";

import type { Company, FiscalPeriod } from "../_constants/companies";
import { fmtYen } from "../_lib/format";
import styles from "./ForestDesign.module.css";

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
    <div className={styles.kpiGrid}>
      {cards.map((card, index) => (
        <article
          key={card.label}
          className={styles.kpiCard}
        >
          <div className={styles.kpiIcon} aria-hidden="true">
            {["¥", "↗", "◇", "≈", "6"][index] ?? "•"}
          </div>
          <p className={styles.kpiLabel}>{card.label}</p>
          <p className={styles.kpiValue}>{card.value}</p>
          <p className={styles.kpiSub}>{card.sub}</p>
        </article>
      ))}
    </div>
  );
}
