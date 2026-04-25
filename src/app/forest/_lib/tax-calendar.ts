/**
 * T-F4-02: 納税カレンダーの純粋ユーティリティ。
 *
 * spec: docs/specs/2026-04-24-forest-t-f4-02-tax-calendar.md §5 Step 1
 *
 * 配置上は queries.ts と並ぶ "ロジック" 層で、Supabase / React に依存しない。
 * 戻り値の型はテストで固定するため `MonthYear` / `YearGroup` /
 * `CalendarCellPills` を本ファイルから export する。
 */

import type { NouzeiScheduleWithItems } from "./types";

/** カレンダーの 1 マス分（年月）を表す。 */
export type MonthYear = {
  y: number;
  m: number; // 1〜12
};

/**
 * カレンダー上で連続する月を年単位に束ねたグループ。
 * `bgClass` / `labelClass` は zebra 背景の交互指定用キー。
 */
export type YearGroup = {
  year: number;
  /** monthYears 配列内の開始 index */
  startIdx: number;
  /** 該当年に属する月数（1〜12） */
  span: number;
  bgClass: "bg-zebra-a" | "bg-zebra-b";
  labelClass: "label-zebra-a" | "label-zebra-b";
};

/** 1 セル分の pill 集約。 */
export type CalendarCellPills = {
  month: MonthYear;
  pills: Array<{
    scheduleId: string;
    kind: NouzeiScheduleWithItems["kind"];
    label: string;
    amount: number | null;
    isPaid: boolean;
  }>;
};

/**
 * 当月を中心としたローリング 12 ヶ月配列を返す。
 * - index 0..4: 5 ヶ月前〜1 ヶ月前
 * - index 5: 当月
 * - index 6..11: 1 ヶ月後〜6 ヶ月後
 */
export function buildRolling12Months(now: Date = new Date()): MonthYear[] {
  const result: MonthYear[] = [];
  for (let i = -5; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    result.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }
  return result;
}

/**
 * 月配列を年単位にグループ化。zebra 背景は出現順に交互。
 */
export function buildYearGroups(monthYears: MonthYear[]): YearGroup[] {
  const groups: YearGroup[] = [];
  let currentYear = -1;
  for (let i = 0; i < monthYears.length; i++) {
    const my = monthYears[i];
    if (my.y !== currentYear) {
      groups.push({
        year: my.y,
        startIdx: i,
        span: 1,
        bgClass: groups.length % 2 === 0 ? "bg-zebra-a" : "bg-zebra-b",
        labelClass:
          groups.length % 2 === 0 ? "label-zebra-a" : "label-zebra-b",
      });
      currentYear = my.y;
    } else {
      groups[groups.length - 1].span++;
    }
  }
  return groups;
}

/** 当月より前なら true。 */
export function isPastMonth(ym: MonthYear, now: Date = new Date()): boolean {
  if (ym.y < now.getFullYear()) return true;
  if (ym.y === now.getFullYear() && ym.m < now.getMonth() + 1) return true;
  return false;
}

/** 当月のみ true。 */
export function isCurrentMonth(
  ym: MonthYear,
  now: Date = new Date(),
): boolean {
  return ym.y === now.getFullYear() && ym.m === now.getMonth() + 1;
}

/**
 * schedules を企業 × monthYears のセル配列に投影する。
 *
 * - companyId 一致の schedule のみ採用
 * - month/year が monthYears のいずれかに合致するものを該当セルに pill として配置
 * - isPaid は status='paid' または過去月なら true
 */
export function pivotSchedulesToCells(
  schedules: NouzeiScheduleWithItems[],
  monthYears: MonthYear[],
  companyId: string,
  now: Date = new Date(),
): CalendarCellPills[] {
  return monthYears.map((my) => {
    const matching = schedules.filter(
      (s) =>
        s.company_id === companyId && s.year === my.y && s.month === my.m,
    );
    const pills = matching.map((s) => ({
      scheduleId: s.id,
      kind: s.kind,
      label: s.label,
      amount: s.total_amount,
      isPaid: s.status === "paid" || isPastMonth(my, now),
    }));
    return { month: my, pills };
  });
}
