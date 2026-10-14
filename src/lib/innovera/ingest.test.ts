import { describe, expect, it, vi } from "vitest";

import { ingestInnoveraRows, normalizeInnoveraRow, parseInnoveraJst, parseTalkSeconds } from "./ingest";

describe("INNOVERA ingest normalization", () => {
  it("converts talk_time to seconds", () => {
    expect(parseTalkSeconds("01:02:03")).toBe(3723);
    expect(parseTalkSeconds("")).toBe(0);
    expect(parseTalkSeconds(null)).toBe(0);
  });

  it("parses INNOVERA JST timestamps as UTC ISO strings", () => {
    expect(parseInnoveraJst("2026-10-13 09:30:00")).toBe("2026-10-13T00:30:00.000Z");
    expect(parseInnoveraJst("0000-00-00 00:00:00")).toBeNull();
  });

  it("skips rows without id or start_time and preserves raw JSON", () => {
    expect(normalizeInnoveraRow({ id: "", start_time: "2026-10-13 09:30:00" })).toBeNull();
    expect(normalizeInnoveraRow({ id: "1", start_time: "" })).toBeNull();
    expect(normalizeInnoveraRow({
      id: "1",
      start_time: "2026-10-13 09:30:00",
      circuit_id: "10",
      call_type: "1",
      dial_status: "2",
      talk_time: "00:01:05",
    })).toMatchObject({
      innovera_id: "1",
      circuit_id: 10,
      call_type: 1,
      dial_status: 2,
      talk_seconds: 65,
      raw: expect.objectContaining({ id: "1" }),
    });
  });

  it("upserts valid rows with explicit conflict handling", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ upsert })) };
    const result = await ingestInnoveraRows([
      { id: "1", start_time: "2026-10-13 09:30:00" },
      { id: "", start_time: "2026-10-13 09:30:00" },
    ], supabase as never);
    expect(result).toEqual({ ok: true, received: 2, upserted: 1, skipped: 1 });
    expect(upsert).toHaveBeenCalledWith([
      expect.objectContaining({ innovera_id: "1", imported_at: expect.any(String) }),
    ], { onConflict: "innovera_id", ignoreDuplicates: false });
  });
});
