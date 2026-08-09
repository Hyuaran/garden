import { describe, expect, it, vi } from "vitest";

import { collectAllRecords } from "./kintone-pagination";

const record = (id: number) => ({ $id: { value: String(id) } });

describe("collectAllRecords", () => {
  it("advances with the last $id and stops on a page smaller than 500", async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => record(index + 1));
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([record(501), record(502)]);

    const records = await collectAllRecords(fetchPage);

    expect(records).toHaveLength(502);
    expect(fetchPage).toHaveBeenNthCalledWith(1, "order by $id asc limit 500");
    expect(fetchPage).toHaveBeenNthCalledWith(2, "$id > 500 order by $id asc limit 500");
  });

  it("requests an empty next page when the preceding page contains exactly 500 records", async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, index) => record(index + 1)))
      .mockResolvedValueOnce([]);

    await expect(collectAllRecords(fetchPage)).resolves.toHaveLength(500);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("stops after the first empty page", async () => {
    const fetchPage = vi.fn().mockResolvedValue([]);

    await expect(collectAllRecords(fetchPage)).resolves.toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("fails instead of looping when a full page does not advance $id", async () => {
    const duplicatePage = Array.from({ length: 500 }, () => record(500));
    const fetchPage = vi.fn().mockResolvedValue(duplicatePage);

    await expect(collectAllRecords(fetchPage)).rejects.toThrow("$idが進みませんでした");
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});
