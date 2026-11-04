import { expect, it } from "vitest";
import { workerDates } from "./ledger";
import type { HakenData, HakenWorker } from "./types";
it("派遣会社が変わっても同じ人・組織単位の期間を継続する", () => {
  const workers = [
    {
      id: "w1",
      employee_id: "EMP-A",
      name: "社員A",
      contract_id: "a",
      start_on: "2024-01-01",
      end_on: "2025-12-31",
    },
    {
      id: "w2",
      employee_id: "EMP-A",
      name: "社員A",
      contract_id: "b",
      start_on: "2026-01-01",
      end_on: "2026-12-31",
    },
  ] as HakenWorker[];
  const data = {
    workers,
    contracts: [
      {
        id: "a",
        side: "ukeire",
        party_id: "A社",
        office_id: "o",
        org_unit: "営業課",
        period_start: "2024-01-01",
        period_end: "2025-12-31",
      },
      {
        id: "b",
        side: "ukeire",
        party_id: "B社",
        office_id: "o",
        org_unit: "営業課",
        period_start: "2026-01-01",
        period_end: "2026-12-31",
        notified_conflict_on: "2029-01-01",
      },
    ],
  } as unknown as HakenData;
  expect(workerDates(data, workers[1])).toMatchObject({
    office: "2027-01-01",
    individual: "2027-01-01",
    mismatch: true,
  });
});
