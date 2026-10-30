import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("小窓のスクロールバー", () => {
  it("全部の小窓でスクロールバーを出さない", () => {
    expect(css).toContain(":where(dialog), [data-garden-modal], .garden-modal-body { scrollbar-width: none; }");
    expect(css).toContain(":where(dialog)::-webkit-scrollbar, [data-garden-modal]::-webkit-scrollbar, .garden-modal-body::-webkit-scrollbar { display: none; }");
  });
});
