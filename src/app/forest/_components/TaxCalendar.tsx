"use client";

/**
 * Garden-Forest TaxCalendar: 納税スケジュール ローリング 12 ヶ月ビュー。
 *
 * spec: docs/specs/2026-04-24-forest-t-f4-02-tax-calendar.md
 *
 * - グリッド: 法人名列 (130px) + 12 月列
 * - 年ラベル行（年単位で span、zebra 背景）
 * - 月ヘッダ行（当月ハイライト）
 * - 法人行（companies 配列の表示順）
 *   各セル: 該当月の schedule を TaxPill で並べる
 * - Legend: 納付済 / 予定納税 / 確定納税
 *
 * Forest 規約に従いインラインスタイル使用。Tailwind 不使用。
 */

import { useMemo } from "react";

import type { Company } from "../_constants/companies";
import { C } from "../_constants/colors";
import { FOREST_THEME } from "../_constants/theme";
import {
  buildRolling12Months,
  buildYearGroups,
  isCurrentMonth,
  pivotSchedulesToCells,
  type CalendarCellPills,
  type MonthYear,
  type YearGroup,
} from "../_lib/tax-calendar";
import type { NouzeiScheduleWithItems } from "../_lib/types";
import { TaxPill } from "./TaxPill";

type Props = {
  companies: Company[];
  schedules: NouzeiScheduleWithItems[];
  onPillClick: (scheduleId: string) => void;
};

export function TaxCalendar({ companies, schedules, onPillClick }: Props) {
  const now = useMemo(() => new Date(), []);
  const monthYears = useMemo(() => buildRolling12Months(now), [now]);
  const yearGroups = useMemo(() => buildYearGroups(monthYears), [monthYears]);

  return (
    <section
      style={{
        background: FOREST_THEME.panelBg,
        border: `1px solid ${FOREST_THEME.panelBorder}`,
        borderRadius: 18,
        padding: 28,
        marginBottom: 28,
        boxShadow: FOREST_THEME.panelShadow,
      }}
    >
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: C.darkGreen,
          margin: "0 0 16px 0",
          paddingBottom: 12,
          borderBottom: `2px solid ${C.mintBg}`,
        }}
      >
        納税カレンダー
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "130px repeat(12, minmax(0, 1fr))",
          fontSize: 12,
          minWidth: 900,
        }}
      >
        {/* 年ラベル行 */}
        <div />
        {yearGroups.map((g) => (
          <YearLabelCell key={`yl-${g.year}`} group={g} />
        ))}

        {/* 月ヘッダ行 */}
        <div />
        {monthYears.map((my, idx) => (
          <MonthHeaderCell
            key={`mh-${my.y}-${my.m}`}
            ym={my}
            now={now}
            isYearStart={idx > 0 && monthYears[idx - 1].y !== my.y}
          />
        ))}

        {/* 法人行 */}
        {companies.map((c) => {
          const cells = pivotSchedulesToCells(
            schedules,
            monthYears,
            c.id,
            now,
          );
          return (
            <CompanyRow
              key={c.id}
              company={c}
              cells={cells}
              now={now}
              onPillClick={onPillClick}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 12,
          fontSize: 11,
          color: C.textMuted,
        }}
      >
        <LegendDot color="#a3b18a" label="納付済" />
        <LegendDot color="#c9a84c" label="予定納税" />
        <LegendDot color="#e07a7a" label="確定納税" />
      </div>
    </section>
  );
}

/* ---- 子コンポーネント ---- */

function YearLabelCell({ group }: { group: YearGroup }) {
  return (
    <div
      style={{
        gridColumn: `span ${group.span}`,
        textAlign: "center",
        fontSize: 12,
        fontWeight: 700,
        color: C.darkGreen,
        background: "rgba(45,106,79,0.04)",
        borderLeft:
          group.bgClass === "bg-zebra-b"
            ? "1px solid rgba(45,106,79,0.18)"
            : undefined,
        padding: "4px 0",
      }}
    >
      {`${group.year}年`}
    </div>
  );
}

function MonthHeaderCell({
  ym,
  now,
  isYearStart,
}: {
  ym: MonthYear;
  now: Date;
  isYearStart: boolean;
}) {
  const isCur = isCurrentMonth(ym, now);
  return (
    <div
      data-testid="month-header"
      style={{
        textAlign: "center",
        fontWeight: 600,
        color: C.textSub,
        padding: "4px 0",
        borderBottom: `2px solid ${C.mintBg}`,
        background: isCur ? "rgba(218,165,32,0.1)" : undefined,
        borderTopLeftRadius: isCur ? 6 : 0,
        borderTopRightRadius: isCur ? 6 : 0,
        borderLeft: isYearStart ? "1px solid rgba(45,106,79,0.18)" : undefined,
      }}
    >
      {`${ym.m}月`}
    </div>
  );
}

function CompanyRow({
  company,
  cells,
  now,
  onPillClick,
}: {
  company: Company;
  cells: CalendarCellPills[];
  now: Date;
  onPillClick: (scheduleId: string) => void;
}) {
  return (
    <>
      {/* 法人名セル */}
      <div
        style={{
          fontWeight: 600,
          color: C.textDark,
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderBottom: "1px solid rgba(45,106,79,0.06)",
          whiteSpace: "nowrap",
          minHeight: 52,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: company.color,
            display: "inline-block",
          }}
        />
        {company.short}
      </div>
      {/* 12 セル */}
      {cells.map(({ month: my, pills }, idx) => {
        const isCur = isCurrentMonth(my, now);
        const isYearStart = idx > 0 && cells[idx - 1].month.y !== my.y;
        return (
          <div
            key={`${company.id}-${my.y}-${my.m}`}
            style={{
              padding: "4px",
              textAlign: "center",
              borderBottom: "1px solid rgba(45,106,79,0.06)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              minHeight: 52,
              background: isCur ? "rgba(218,165,32,0.05)" : undefined,
              borderLeft: isYearStart
                ? "1px solid rgba(45,106,79,0.18)"
                : undefined,
            }}
          >
            {pills.map((pill) => (
              <TaxPill
                key={pill.scheduleId}
                kind={pill.kind}
                label={pill.label}
                amount={pill.amount}
                isPaid={pill.isPaid}
                onClick={() => onPillClick(pill.scheduleId)}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}
