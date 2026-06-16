/**
 * T-F4-02: TaxCalendar のユニットテスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f4-02-tax-calendar.md §10
 *
 * `new Date()` を vi.setSystemTime で 2026-04-25 に固定し、
 * ローリング 12 ヶ月（2025-11 〜 2026-10）を前提とする。
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import type { Company } from "@/app/forest/_constants/companies";
import type { NouzeiScheduleWithItems } from "@/app/forest/_lib/types";
import { TaxCalendar } from "@/app/forest/_components/TaxCalendar";

const hyuaran: Company = {
  id: "hyuaran",
  name: "ヒュアラン",
  short: "ヒュアラン",
  kessan: "3",
  color: "#1e3a8a",
  light: "#bfdbfe",
  sort_order: 1,
};
const arata: Company = {
  id: "arata",
  name: "ARATA",
  short: "ARATA",
  kessan: "12",
  color: "#dc2626",
  light: "#fecaca",
  sort_order: 2,
};

function makeSchedule(
  overrides: Partial<NouzeiScheduleWithItems> = {},
): NouzeiScheduleWithItems {
  return {
    id: "sched-1",
    company_id: "hyuaran",
    kind: "yotei",
    label: "予定",
    year: 2026,
    month: 11,
    due_date: "2026-11-30",
    total_amount: 2_324_000,
    status: "pending",
    paid_at: null,
    notes: null,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    items: [],
    ...overrides,
  };
}

describe("TaxCalendar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 25)); // 2026-04-25
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the section title 納税カレンダー", () => {
    render(
      <TaxCalendar
        companies={[hyuaran]}
        schedules={[]}
        onPillClick={() => {}}
      />,
    );
    expect(screen.getByText("納税カレンダー")).toBeInTheDocument();
  });

  it("renders all 12 month header cells", () => {
    render(
      <TaxCalendar
        companies={[hyuaran]}
        schedules={[]}
        onPillClick={() => {}}
      />,
    );
    // 11月 出現は 2025/11 + 2026/11 だけど、月ヘッダは 11月 が 2 個出る可能性あり
    // 厳密に 12 個の月ヘッダを検出するため data-testid を採用
    const headers = screen.getAllByTestId("month-header");
    expect(headers).toHaveLength(12);
  });

  it("renders the year labels for each spanned year", () => {
    render(
      <TaxCalendar
        companies={[hyuaran]}
        schedules={[]}
        onPillClick={() => {}}
      />,
    );
    expect(screen.getByText("2025年")).toBeInTheDocument();
    expect(screen.getByText("2026年")).toBeInTheDocument();
  });

  it("renders a row for each company with its short name", () => {
    render(
      <TaxCalendar
        companies={[hyuaran, arata]}
        schedules={[]}
        onPillClick={() => {}}
      />,
    );
    expect(screen.getByText("ヒュアラン")).toBeInTheDocument();
    expect(screen.getByText("ARATA")).toBeInTheDocument();
  });

  it("renders TaxPill for a matching schedule", () => {
    const sched = makeSchedule({
      id: "s-future",
      year: 2026,
      month: 8,
      label: "予定",
      total_amount: 1_000_000,
      status: "pending",
    });
    render(
      <TaxCalendar
        companies={[hyuaran]}
        schedules={[sched]}
        onPillClick={() => {}}
      />,
    );
    // ボタンは TaxPill。aria-label が '予定 100万' を含む
    expect(
      screen.getByRole("button", { name: /予定.*100万/ }),
    ).toBeInTheDocument();
  });

  it("calls onPillClick(scheduleId) when a pill is clicked", () => {
    const onPillClick = vi.fn();
    const sched = makeSchedule({
      id: "click-target",
      year: 2026,
      month: 8,
      label: "予定",
    });
    render(
      <TaxCalendar
        companies={[hyuaran]}
        schedules={[sched]}
        onPillClick={onPillClick}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /予定/ }));
    expect(onPillClick).toHaveBeenCalledWith("click-target");
  });

  it("renders the 3 legend items", () => {
    render(
      <TaxCalendar
        companies={[]}
        schedules={[]}
        onPillClick={() => {}}
      />,
    );
    expect(screen.getByText("納付済")).toBeInTheDocument();
    expect(screen.getByText("予定納税")).toBeInTheDocument();
    expect(screen.getByText("確定納税")).toBeInTheDocument();
  });

  it("does not render pills for schedules outside the rolling 12 months", () => {
    const farPast = makeSchedule({
      id: "far-past",
      year: 2024,
      month: 1,
    });
    const farFuture = makeSchedule({
      id: "far-future",
      year: 2027,
      month: 12,
    });
    render(
      <TaxCalendar
        companies={[hyuaran]}
        schedules={[farPast, farFuture]}
        onPillClick={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /予定/ })).not.toBeInTheDocument();
  });

  it("places multiple pills in the same cell when same month", () => {
    const a = makeSchedule({ id: "a", year: 2026, month: 8, label: "予定" });
    const b = makeSchedule({
      id: "b",
      year: 2026,
      month: 8,
      kind: "extra",
      label: "予定（消費税）",
    });
    render(
      <TaxCalendar
        companies={[hyuaran]}
        schedules={[a, b]}
        onPillClick={() => {}}
      />,
    );
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(2);
  });

  it("filters schedules by company correctly", () => {
    const forArata = makeSchedule({
      id: "arata-only",
      company_id: "arata",
      year: 2026,
      month: 5,
      label: "予定",
    });
    render(
      <TaxCalendar
        companies={[hyuaran, arata]}
        schedules={[forArata]}
        onPillClick={() => {}}
      />,
    );
    // 予定 pill は 1 つだけ存在（arata 行）
    expect(screen.getAllByRole("button", { name: /予定/ })).toHaveLength(1);
  });
});
