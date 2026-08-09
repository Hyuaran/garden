import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAllRecords: vi.fn(),
  getRecords: vi.fn(),
  requirePartnerOrStaff: vi.fn(),
}));

vi.mock("@/app/p/toss/_lib/kintone.server", () => ({ getAllRecords: mocks.getAllRecords, getRecords: mocks.getRecords }));
vi.mock("@/app/p/_lib/server-auth", () => ({
  requirePartnerOrStaff: mocks.requirePartnerOrStaff,
  tossError: (error: unknown) => ({ status: 500, message: error instanceof Error ? error.message : "error" }),
}));

import { GET } from "./route";

const tossRecord = (id: string, partnerCode: string) => ({
  $id: { value: id },
  ルックアップ: { value: partnerCode },
});
const rosterRecord = (partnerCode: string | number) => ({ 数値: { value: partnerCode } });

describe("GET /api/toss/board", () => {
  beforeEach(() => {
    mocks.getRecords.mockReset();
    mocks.getAllRecords.mockReset();
    mocks.requirePartnerOrStaff.mockReset();
    process.env.KINTONE_TOSSUP_APP_ID = "40";
    process.env.KINTONE_TOSSUP_TOKEN = "toss-token";
    process.env.KINTONE_DIVISION_ROSTER_APP_ID = "38";
    process.env.KINTONE_DIVISION_ROSTER_TOKEN = "roster-token";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns only rows whose trimmed partner code is in the Kanden roster", async () => {
    mocks.requirePartnerOrStaff.mockResolvedValue({ kind: "staff" });
    mocks.getAllRecords.mockResolvedValue([tossRecord("1", "1234567"), tossRecord("2", "7654321"), tossRecord("3", "9999999")]);
    mocks.getRecords.mockResolvedValue({ records: [rosterRecord(" 1234567 "), rosterRecord(7654321)] });

    const response = await GET(new Request("http://localhost/api/toss/board"));
    const body = await response.json();

    expect(body.rows.map((row: { id: string }) => row.id)).toEqual(["1", "2"]);
    expect(mocks.getRecords).toHaveBeenCalledWith("38", "roster-token", 'ドロップダウン_2 in ("関電トス") limit 500');
  });

  it("combines the roster filter with the partner's mine filter", async () => {
    mocks.requirePartnerOrStaff.mockResolvedValue({ kind: "partner", partnerCode: "1234567" });
    mocks.getAllRecords.mockResolvedValue([tossRecord("1", "1234567"), tossRecord("2", "7654321")]);
    mocks.getRecords.mockResolvedValue({ records: [rosterRecord("1234567"), rosterRecord("7654321")] });

    const response = await GET(new Request("http://localhost/api/toss/board"));
    const body = await response.json();

    expect(body.mine).toBe(true);
    expect(body.rows.map((row: { id: string }) => row.id)).toEqual(["1"]);
  });

  it("falls back to all existing rows and logs a warning when the roster lookup fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.requirePartnerOrStaff.mockResolvedValue({ kind: "staff" });
    mocks.getAllRecords.mockResolvedValue([tossRecord("1", "1234567"), tossRecord("2", "9999999")]);
    mocks.getRecords.mockRejectedValue(new Error("roster unavailable"));

    const response = await GET(new Request("http://localhost/api/toss/board"));
    const body = await response.json();

    expect(body.rows.map((row: { id: string }) => row.id)).toEqual(["1", "2"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("名簿フィルターなし"), expect.any(Error));
  });

  it("sorts all fetched rows by introduced date descending and never reports a 500-record limit", async () => {
    mocks.requirePartnerOrStaff.mockResolvedValue({ kind: "staff" });
    mocks.getAllRecords.mockResolvedValue([
      { ...tossRecord("1", "1234567"), 日付: { value: "2024-01-01" } },
      { ...tossRecord("2", "1234567"), 日付: { value: "2026-01-01" } },
    ]);
    mocks.getRecords.mockResolvedValue({ records: [rosterRecord("1234567")] });

    const response = await GET(new Request("http://localhost/api/toss/board"));
    const body = await response.json();

    expect(body.rows.map((row: { id: string }) => row.id)).toEqual(["2", "1"]);
    expect(body.limited).toBe(false);
  });
});
