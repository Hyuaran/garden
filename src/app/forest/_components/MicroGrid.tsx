"use client";

/**
 * Garden-Forest ミクログリッド
 *
 * 6法人 × 年度 のマトリクス。各セルに売上/外注/利益 + ミニバー。
 * 進行期はゴールドバッジ。クリックで DetailModal。
 * v9 の renderMicroGrid() を React 化。
 */

import { useEffect, useMemo, useRef, useState } from "react";

import type { CellData, Company, FiscalPeriod, Shinkouki } from "../_constants/companies";
import { FOREST_THEME } from "../_constants/theme";
import { C } from "../_constants/colors";
import { fmtYen } from "../_lib/format";
import { writeAuditLog } from "../_lib/audit";
import { DetailModal } from "./DetailModal";

type Props = {
  companies: Company[];
  periods: FiscalPeriod[];
  shinkouki: Shinkouki[];
  /** 進行期セルクリック時のハンドラ（admin のみ渡す）。undefined なら DetailModal にフォールバック */
  onEditShinkouki?: (companyId: string) => void;
};

export function MicroGrid({ companies, periods, shinkouki, onEditShinkouki }: Props) {
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const years = useMemo(() => {
    const allYears = [
      ...periods.map((p) => p.yr),
      ...shinkouki.map((s) => s.yr),
    ];
    if (allYears.length === 0) return [];
    const min = Math.min(...allYears);
    const max = Math.max(...allYears);
    const result: number[] = [];
    for (let y = min; y <= max; y++) result.push(y);
    return result;
  }, [periods, shinkouki]);

  // グループ計
  const groupTotals = useMemo(() => {
    return years.map((y) => {
      let total = 0;
      companies.forEach((c) => {
        const p = periods.find((pp) => pp.company_id === c.id && pp.yr === y);
        if (p) {
          total += p.uriage ?? 0;
        } else {
          const sk = shinkouki.find((s) => s.company_id === c.id && s.yr === y);
          if (sk?.uriage != null) total += sk.uriage;
        }
      });
      return total;
    });
  }, [years, companies, periods, shinkouki]);

  // T-F9 D8: 初期表示時に最右端（最新年度）へスクロール。
  // years が確定した後に rAF で scrollLeft = scrollWidth を設定。
  useEffect(() => {
    if (years.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth;
    });
    return () => cancelAnimationFrame(id);
  }, [years]);

  const handleCellClick = (cellData: CellData) => {
    // 進行期セルで admin なら編集モーダル、それ以外は詳細モーダル
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
      {/* グループ計 */}
      <div
        style={{
          background: FOREST_THEME.panelBg,
          backdropFilter: "blur(20px)",
          border: `1px solid ${FOREST_THEME.panelBorder}`,
          borderRadius: FOREST_THEME.panelRadius,
          padding: "16px 24px",
          boxShadow: FOREST_THEME.panelShadow,
          marginBottom: 16,
          overflowX: "auto",
        }}
      >
        <div style={{ display: "flex", gap: 0, minWidth: years.length * 130 + 160 }}>
          <div style={{ width: 160, flexShrink: 0, fontWeight: 700, fontSize: 13, padding: "8px 0" }}>
            グループ計
          </div>
          {years.map((y, i) => (
            <div
              key={y}
              style={{
                width: 130,
                flexShrink: 0,
                textAlign: "center",
                padding: "8px 4px",
                fontSize: 13,
                fontWeight: 700,
                color: groupTotals[i] > 0 ? FOREST_THEME.textPrimary : FOREST_THEME.textMuted,
              }}
            >
              {groupTotals[i] > 0 ? fmtYen(groupTotals[i]) : "―"}
            </div>
          ))}
        </div>
      </div>

      {/* メイングリッド */}
      <div
        ref={scrollRef}
        data-testid="microgrid-scroll"
        style={{
          background: FOREST_THEME.panelBg,
          backdropFilter: "blur(20px)",
          border: `1px solid ${FOREST_THEME.panelBorder}`,
          borderRadius: FOREST_THEME.panelRadius,
          padding: 24,
          boxShadow: FOREST_THEME.panelShadow,
          marginBottom: 32,
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: years.length * 130 + 160 }}>
          <thead>
            <tr>
              {/* T-F9 D2: sticky col-company（ヘッダ） — 横スクロール時も法人列を保持 */}
              <th
                style={{
                  width: 160,
                  textAlign: "left",
                  padding: "8px 0",
                  fontSize: 12,
                  color: FOREST_THEME.textMuted,
                  position: "sticky",
                  left: 0,
                  zIndex: 4,
                  background: FOREST_THEME.stickyBg,
                }}
              >
                法人
              </th>
              {years.map((y) => (
                <th key={y} style={{ width: 130, textAlign: "center", padding: "8px 4px", fontSize: 12, color: FOREST_THEME.textMuted }}>
                  {`${y}年度`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const sk = shinkouki.find((s) => s.company_id === c.id);
              const compPeriods = periods.filter((p) => p.company_id === c.id);
              const allValues = [
                ...compPeriods.map((p) => p.uriage ?? 0),
                ...compPeriods.filter((p) => p.gaichuhi != null).map((p) => p.gaichuhi!),
                ...compPeriods.map((p) => Math.abs(p.rieki ?? 0)),
              ];
              if (sk?.uriage != null) allValues.push(sk.uriage);
              if (sk?.gaichuhi != null) allValues.push(sk.gaichuhi);
              if (sk?.rieki != null) allValues.push(Math.abs(sk.rieki));
              const maxVal = Math.max(...allValues, 1);

              return (
                <tr key={c.id}>
                  {/* T-F9 D2: sticky col-company（ボディ） — 横スクロール時も法人列を保持 */}
                  <td
                    style={{
                      padding: "10px 12px",
                      borderTop: "1px solid #f0f0f0",
                      position: "sticky",
                      left: 0,
                      zIndex: 3,
                      background: FOREST_THEME.stickyBg,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.short}</div>
                        <div style={{ fontSize: 10, color: FOREST_THEME.textMuted }}>{`${c.kessan}決算`}</div>
                      </div>
                    </div>
                  </td>
                  {years.map((y) => {
                    const p = compPeriods.find((pp) => pp.yr === y);
                    const isSK = !p && sk?.yr === y;
                    const src = p ?? (isSK ? sk : null);

                    if (!src) {
                      return (
                        <td key={y} style={{ textAlign: "center", padding: 8, borderTop: "1px solid #f0f0f0", color: "#ccc", fontSize: 12 }}>
                          ―
                        </td>
                      );
                    }

                    const hasU = src.uriage != null;
                    const hasG = src.gaichuhi != null;
                    const hasR = src.rieki != null;
                    const isNeg = hasR && src.rieki! < 0;
                    // T-F9 D10: 進行期 + zantei フラグの両方が true のとき灰色化
                    const isZantei = isSK && sk?.zantei === true;
                    const barU = hasU ? Math.round(Math.sqrt(Math.max(0, src.uriage!) / maxVal) * 40) : 0;
                    const barG = hasG ? Math.round(Math.sqrt(Math.max(0, src.gaichuhi!) / maxVal) * 40) : 0;
                    const barR = hasR ? Math.round(Math.sqrt(Math.abs(src.rieki!) / maxVal) * 40) : 0;

                    const cellData: CellData = {
                      company: c,
                      ki: isSK ? sk!.ki : (p as FiscalPeriod).ki,
                      yr: y,
                      period_from: isSK ? sk!.range.split("~")[0] : (p as FiscalPeriod).period_from,
                      period_to: isSK ? sk!.range.split("~")[1] : (p as FiscalPeriod).period_to,
                      uriage: src.uriage ?? null,
                      gaichuhi: src.gaichuhi ?? null,
                      rieki: src.rieki ?? null,
                      junshisan: p ? (p as FiscalPeriod).junshisan : null,
                      genkin: p ? (p as FiscalPeriod).genkin : null,
                      yokin: p ? (p as FiscalPeriod).yokin : null,
                      doc_url: p ? (p as FiscalPeriod).doc_url : null,
                      isShinkouki: !!isSK,
                      reflected: isSK ? sk!.reflected : null,
                      zantei: isSK ? sk!.zantei : false,
                    };

                    return (
                      <td
                        key={y}
                        onClick={() => handleCellClick(cellData)}
                        style={{
                          padding: 6,
                          borderTop: "1px solid #f0f0f0",
                          cursor: "pointer",
                          verticalAlign: "top",
                        }}
                      >
                        <div
                          className={isSK ? "shinkou-animate" : undefined}
                          style={{
                            // T-F9 D4: 進行期セルは v9 と同じ柔らかい黄土系にし、
                            // className 'shinkou-animate' で globals.css の glow を適用
                            background: isSK
                              ? "rgba(255, 248, 230, 0.4)"
                              : "rgba(27,67,50,0.03)",
                            borderRadius: 10,
                            padding: "8px 10px",
                            border: isSK
                              ? "2px solid rgba(218, 165, 32, 0.5)"
                              : "1px solid transparent",
                            transition: "background 0.15s",
                          }}
                        >
                          {/* 期バッジ */}
                          <div
                            style={{
                              display: "inline-block",
                              padding: "1px 8px",
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#fff",
                              background: isSK ? FOREST_THEME.shinkouBadge : c.color,
                              marginBottom: 6,
                            }}
                          >
                            {`第${cellData.ki}期`}
                          </div>

                          {/* メトリクス */}
                          <div style={{ display: "flex", gap: 6 }}>
                            <div style={{ flex: 1, fontSize: 10, lineHeight: 1.8 }}>
                              <div>
                                <span style={{ color: FOREST_THEME.textMuted }}>売上 </span>
                                {/* T-F9 D10: zantei (進行期かつ暫定) は灰色化 */}
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color: isZantei ? "#999" : undefined,
                                  }}
                                >
                                  {hasU ? fmtYen(src.uriage!) : "―"}
                                </span>
                              </div>
                              <div>
                                <span style={{ color: FOREST_THEME.textMuted }}>外注 </span>
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color: isZantei ? "#999" : undefined,
                                  }}
                                >
                                  {hasG ? fmtYen(src.gaichuhi!) : "―"}
                                </span>
                              </div>
                              <div>
                                <span style={{ color: FOREST_THEME.textMuted }}>利益 </span>
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color: isZantei
                                      ? "#999"
                                      : isNeg
                                        ? FOREST_THEME.negative
                                        : FOREST_THEME.positive,
                                  }}
                                >
                                  {hasR ? fmtYen(src.rieki!) : "―"}
                                </span>
                              </div>
                            </div>

                            {/* ミニバー: T-F9 D10 で zantei 時は opacity 0.35 */}
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
                              {hasU && (
                                <div
                                  data-testid="microgrid-mini-bar"
                                  style={{
                                    width: 4,
                                    height: Math.max(barU, 2),
                                    background: C.midGreen,
                                    borderRadius: 2,
                                    opacity: isZantei ? 0.35 : 1,
                                  }}
                                />
                              )}
                              {hasG && (
                                <div
                                  data-testid="microgrid-mini-bar"
                                  style={{
                                    width: 4,
                                    height: Math.max(barG, 2),
                                    background: C.paleGreen,
                                    borderRadius: 2,
                                    opacity: isZantei ? 0.35 : 1,
                                  }}
                                />
                              )}
                              {hasR && (
                                <div
                                  data-testid="microgrid-mini-bar"
                                  style={{
                                    width: 4,
                                    height: isNeg ? 5 : Math.max(barR, 2),
                                    background: isNeg ? C.red : C.accentGreen,
                                    borderRadius: 2,
                                    opacity: isZantei ? 0.35 : 1,
                                  }}
                                />
                              )}
                            </div>
                          </div>

                          {/* 期間表示 */}
                          <div style={{ fontSize: 9, color: FOREST_THEME.textMuted, marginTop: 4 }}>
                            {`${cellData.period_from}~${cellData.period_to}`}
                            {isSK && sk!.reflected && (
                              <>
                                <br />
                                {sk!.reflected}
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* DetailModal */}
      {selectedCell && (
        <DetailModal data={selectedCell} onClose={() => setSelectedCell(null)} />
      )}
    </>
  );
}
