"use client";

import { useMemo, useState } from "react";

import type { CellData, Company, FiscalPeriod, Shinkouki } from "../_constants/companies";
import { C } from "../_constants/colors";
import { FOREST_THEME } from "../_constants/theme";
import { writeAuditLog } from "../_lib/audit";
import { fmtYen } from "../_lib/format";
import { DetailModal } from "./DetailModal";
import styles from "./ForestDesign.module.css";

type Props = {
  companies: Company[];
  periods: FiscalPeriod[];
  shinkouki: Shinkouki[];
  onEditShinkouki?: (companyId: string) => void;
};

export function MicroGrid({ companies, periods, shinkouki, onEditShinkouki }: Props) {
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null);

  const years = useMemo(() => {
    const allYears = [...periods.map((p) => p.yr), ...shinkouki.map((s) => s.yr)];
    if (allYears.length === 0) return [];
    const min = Math.min(...allYears);
    const max = Math.max(...allYears);
    const result: number[] = [];
    for (let y = min; y <= max; y++) result.push(y);
    return result;
  }, [periods, shinkouki]);

  const groupTotals = useMemo(
    () =>
      years.map((year) =>
        companies.reduce((total, company) => {
          const period = periods.find((p) => p.company_id === company.id && p.yr === year);
          if (period) return total + (period.uriage ?? 0);
          const active = shinkouki.find((s) => s.company_id === company.id && s.yr === year);
          return total + (active?.uriage ?? 0);
        }, 0),
      ),
    [years, companies, periods, shinkouki],
  );

  const handleCellClick = (cellData: CellData) => {
    if (cellData.isShinkouki && onEditShinkouki) {
      onEditShinkouki(cellData.company.id);
      return;
    }
    writeAuditLog("view_detail", `${cellData.company.id}_ki${cellData.ki}`);
    setSelectedCell(cellData);
  };

  if (years.length === 0) return null;

  return (
    <>
      <section className={`${styles.panel} ${styles.matrixWrap}`}>
        <h3 className={styles.panelTitle}>Group Total</h3>
        <div style={{ display: "flex", minWidth: years.length * 130 + 170 }}>
          <div style={{ width: 170, flexShrink: 0, color: "#1b4332", fontWeight: 800 }}>
            売上合計
          </div>
          {years.map((year, index) => (
            <div
              key={year}
              style={{
                width: 130,
                flexShrink: 0,
                color: groupTotals[index] > 0 ? "#1b4332" : "#8aa592",
                fontSize: 13,
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              {groupTotals[index] > 0 ? fmtYen(groupTotals[index]) : "-"}
            </div>
          ))}
        </div>
      </section>

      <section className={`${styles.panel} ${styles.matrixWrap}`}>
        <h3 className={styles.panelTitle}>6法人マトリクス</h3>
        <table className={styles.matrixTable} style={{ minWidth: years.length * 130 + 170 }}>
          <thead>
            <tr>
              <th style={{ width: 170 }}>法人</th>
              {years.map((year) => (
                <th key={year} style={{ width: 130 }}>
                  {year}年度
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => {
              const activePeriod = shinkouki.find((s) => s.company_id === company.id);
              const companyPeriods = periods.filter((p) => p.company_id === company.id);
              const allValues = [
                ...companyPeriods.map((p) => p.uriage ?? 0),
                ...companyPeriods.filter((p) => p.gaichuhi != null).map((p) => p.gaichuhi!),
                ...companyPeriods.map((p) => Math.abs(p.rieki ?? 0)),
              ];
              if (activePeriod?.uriage != null) allValues.push(activePeriod.uriage);
              if (activePeriod?.gaichuhi != null) allValues.push(activePeriod.gaichuhi);
              if (activePeriod?.rieki != null) allValues.push(Math.abs(activePeriod.rieki));
              const maxVal = Math.max(...allValues, 1);

              return (
                <tr key={company.id}>
                  <td className={styles.matrixCompanyCell}>
                    <div className={styles.companyLine}>
                      <span className={styles.companyDot} style={{ background: company.color }} />
                      <div>
                        <div className={styles.companyName}>{company.short}</div>
                        <div style={{ color: "#6c8d78", fontSize: 10 }}>{company.kessan}決算</div>
                      </div>
                    </div>
                  </td>
                  {years.map((year) => {
                    const period = companyPeriods.find((p) => p.yr === year);
                    const isActive = !period && activePeriod?.yr === year;
                    const source = period ?? (isActive ? activePeriod : null);

                    if (!source) {
                      return (
                        <td key={year} className={styles.matrixDataCell}>
                          <div className={styles.emptyCell}>-</div>
                        </td>
                      );
                    }

                    const hasSales = source.uriage != null;
                    const hasOutsource = source.gaichuhi != null;
                    const hasProfit = source.rieki != null;
                    const isNegative = hasProfit && source.rieki! < 0;
                    const barSales = hasSales ? Math.round(Math.sqrt(Math.max(0, source.uriage!) / maxVal) * 40) : 0;
                    const barOutsource = hasOutsource ? Math.round(Math.sqrt(Math.max(0, source.gaichuhi!) / maxVal) * 40) : 0;
                    const barProfit = hasProfit ? Math.round(Math.sqrt(Math.abs(source.rieki!) / maxVal) * 40) : 0;
                    const periodData = period as FiscalPeriod | null;
                    const activeData = activePeriod as Shinkouki | null;
                    const cellData: CellData = {
                      company,
                      ki: isActive ? activeData!.ki : periodData!.ki,
                      yr: year,
                      period_from: isActive ? activeData!.range.split("~")[0] : periodData!.period_from,
                      period_to: isActive ? activeData!.range.split("~")[1] : periodData!.period_to,
                      uriage: source.uriage ?? null,
                      gaichuhi: source.gaichuhi ?? null,
                      rieki: source.rieki ?? null,
                      junshisan: periodData ? periodData.junshisan : null,
                      genkin: periodData ? periodData.genkin : null,
                      yokin: periodData ? periodData.yokin : null,
                      doc_url: periodData ? periodData.doc_url : null,
                      isShinkouki: !!isActive,
                      reflected: isActive ? activeData!.reflected : null,
                      zantei: isActive ? activeData!.zantei : false,
                    };

                    return (
                      <td key={year} className={styles.matrixDataCell}>
                        <button
                          type="button"
                          className={`${styles.matrixMiniCard} ${isActive ? styles.matrixMiniCardShinkou : ""}`}
                          onClick={() => handleCellClick(cellData)}
                        >
                          <span
                            className={styles.kiBadge}
                            style={{ background: isActive ? FOREST_THEME.shinkouBadge : company.color }}
                          >
                            第{cellData.ki}期
                          </span>
                          <div className={styles.metricLine}>
                            <span>売上</span>
                            <span className={styles.metricValue}>{hasSales ? fmtYen(source.uriage!) : "-"}</span>
                          </div>
                          <div className={styles.metricLine}>
                            <span>外注</span>
                            <span className={styles.metricValue}>
                              {hasOutsource ? fmtYen(source.gaichuhi!) : "-"}
                            </span>
                          </div>
                          <div className={styles.metricLine}>
                            <span>利益</span>
                            <span
                              className={styles.metricValue}
                              style={{ color: isNegative ? FOREST_THEME.negative : FOREST_THEME.positive }}
                            >
                              {hasProfit ? fmtYen(source.rieki!) : "-"}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, minHeight: 42, marginTop: 8 }}>
                            {hasSales && <span style={{ width: 5, height: Math.max(barSales, 2), background: C.midGreen, borderRadius: 999 }} />}
                            {hasOutsource && <span style={{ width: 5, height: Math.max(barOutsource, 2), background: C.paleGreen, borderRadius: 999 }} />}
                            {hasProfit && (
                              <span
                                style={{
                                  width: 5,
                                  height: isNegative ? 6 : Math.max(barProfit, 2),
                                  background: isNegative ? C.red : C.accentGreen,
                                  borderRadius: 999,
                                }}
                              />
                            )}
                          </div>
                          <div style={{ color: "#6c8d78", fontSize: 9, marginTop: 6 }}>
                            {cellData.period_from}~{cellData.period_to}
                            {isActive && activeData!.reflected && (
                              <>
                                <br />
                                {activeData!.reflected}
                              </>
                            )}
                          </div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {selectedCell && <DetailModal data={selectedCell} onClose={() => setSelectedCell(null)} />}
    </>
  );
}
