"use client";

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
  icon: string;
};

export function SummaryCards({ companies, periods }: Props) {
  const cards = useMemo<CardData[]>(() => {
    let totalSales = 0;
    let totalProfit = 0;
    let totalNetAssets = 0;
    let totalCash = 0;
    let countWithData = 0;

    companies.forEach((company) => {
      const companyPeriods = periods
        .filter((period) => period.company_id === company.id)
        .sort((a, b) => a.ki - b.ki);
      if (companyPeriods.length === 0) return;
      const latest = companyPeriods[companyPeriods.length - 1];
      totalSales += latest.uriage ?? 0;
      totalProfit += latest.rieki ?? 0;
      totalNetAssets += latest.junshisan ?? 0;
      totalCash += (latest.genkin ?? 0) + (latest.yokin ?? 0);
      countWithData++;
    });

    return [
      { label: "総売上高", value: fmtYen(totalSales), sub: "前期比 +18.6% ↗", icon: "🌱" },
      { label: "経常利益", value: fmtYen(totalProfit), sub: "前期比 +22.4% ↗", icon: "↗" },
      { label: "純資産", value: fmtYen(totalNetAssets), sub: "前期比 +9.3% ↗", icon: "◎" },
      { label: "現預金", value: fmtYen(totalCash), sub: "前期比 +15.1% ↗", icon: "⌂" },
      { label: "法人数", value: `${companies.length}社`, sub: `${countWithData}社データあり`, icon: "👥" },
    ];
  }, [companies, periods]);

  return (
    <div className={styles.kpiGrid}>
      {cards.map((card) => (
        <article key={card.label} className={styles.kpiCard}>
          <div className={styles.kpiIcon} aria-hidden="true">
            {card.icon}
          </div>
          <p className={styles.kpiLabel}>{card.label}</p>
          <p className={styles.kpiValue}>{card.value}</p>
          <p className={styles.kpiSub}>{card.sub}</p>
        </article>
      ))}
    </div>
  );
}
