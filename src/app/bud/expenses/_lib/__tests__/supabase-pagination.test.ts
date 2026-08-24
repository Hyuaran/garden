import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { readAllSupabasePages } from "../supabase-pagination";

describe("readAllSupabasePages", () => {
  it("reads past the Supabase 1000-row limit until the final partial page", async () => {
    const source = Array.from({ length: 2501 }, (_, index) => index);
    const calls: Array<[number, number]> = [];
    const result = await readAllSupabasePages((from, to) => {
      calls.push([from, to]);
      return Promise.resolve({ data: source.slice(from, to + 1), error: null });
    });
    expect(result.data).toHaveLength(2501);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("is used by the booking queue, ledger Excel and selected Yayoi export", () => {
    for (const file of [
      "src/app/bud/expenses/_components/ExpenseBookingPanel.tsx",
      "src/app/api/bud/expense-booking/ledger-export/route.ts",
      "src/app/api/bud/expense-booking/export/route.ts",
    ]) {
      expect(fs.readFileSync(path.join(process.cwd(), file), "utf8"), file).toContain("readAllSupabasePages");
    }
  });

  it("warns when the complete booking queue grows beyond 2000 rows", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/bud/expenses/_components/ExpenseBookingPanel.tsx"), "utf8");
    expect(source).toContain("queueAll.length > 2000");
    expect(source).toContain("件数が多くなっています。表示に時間がかかる場合があります。");
  });
});
