import { describe, expect, it, vi } from "vitest";
import { deliverCallReport } from "./call-report-delivery";
import type { CallMetricsResponse } from "./call-metrics";

const metrics: CallMetricsResponse = { from: "2026-08-21", to: "2026-08-21", listName: null, employeeName: null, metrics: [], employeeMetrics: [], lastImportedAt: null };

describe("deliverCallReport", () => {
  it("sends the text and generated PDF in one attachment request", async () => {
    const deps = { renderPdf: vi.fn().mockResolvedValue(Buffer.from("pdf")), sendAttachment: vi.fn().mockResolvedValue({ ok: true }), sendMessage: vi.fn() };
    const result = await deliverCallReport("本文", metrics, new Date("2026-08-21T07:05:00Z"), deps);
    expect(result).toEqual({ attached: true, filename: "テレマコール集計ポータル_20260821_1600.pdf" });
    expect(deps.sendAttachment).toHaveBeenCalledWith("本文", expect.anything(), "テレマコール集計ポータル_20260821_1600.pdf");
    expect(Buffer.isBuffer(deps.sendAttachment.mock.calls[0][1])).toBe(true);
    expect(deps.sendMessage).not.toHaveBeenCalled();
  });

  it("always falls back to the original text message when PDF generation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const deps = { renderPdf: vi.fn().mockRejectedValue(new Error("font failed")), sendAttachment: vi.fn(), sendMessage: vi.fn().mockResolvedValue({ ok: true }) };
    await expect(deliverCallReport("本文", metrics, new Date("2026-08-21T07:05:00Z"), deps)).resolves.toEqual({ attached: false, filename: null });
    expect(deps.sendAttachment).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalledWith("本文");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("falling back"), { errorName: "Error" });
  });

  it("falls back to text when the multipart upload fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const deps = { renderPdf: vi.fn().mockResolvedValue(Buffer.from("pdf")), sendAttachment: vi.fn().mockRejectedValue(new Error("upload failed")), sendMessage: vi.fn().mockResolvedValue({ ok: true }) };
    await deliverCallReport("本文", metrics, new Date("2026-08-21T07:05:00Z"), deps);
    expect(deps.sendMessage).toHaveBeenCalledWith("本文");
  });
});
