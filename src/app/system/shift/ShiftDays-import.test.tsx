import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import ShiftDays from "./ShiftDays";
it("shows an imported 18:30 value rather than rest while keeping later self options absent", () => {
  render(
    <ShiftDays
      rows={[{ work_date: "2026-11-04", start_time: "18:30" }]}
      onChange={() => {}}
    />,
  );
  expect(
    screen.getByRole("combobox", { name: "11/4(水)のシフト" }),
  ).toHaveValue("18:30");
  expect(
    screen.queryByRole("option", { name: "19:00〜21:00" }),
  ).not.toBeInTheDocument();
});
it("offers starts through 20:30 to a manager", () => {
  render(
    <ShiftDays
      manager
      rows={[{ work_date: "2026-11-04", start_time: "18:30" }]}
      onChange={() => {}}
    />,
  );
  expect(
    screen.getAllByRole("option", { name: "20:30〜21:00" }).length,
  ).toBeGreaterThan(0);
});
