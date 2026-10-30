import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("小窓のスクロールバー", () => {
  it("全部の小窓でスクロールバーを出さない", () => {
    const target = ':where(dialog, [role="dialog"], [aria-modal="true"], [data-garden-modal])';
    expect(css).toContain(`${target}, ${target} * { scrollbar-width: none; }`);
    expect(css).toContain(`${target}::-webkit-scrollbar, ${target} *::-webkit-scrollbar { display: none; }`);
  });
});
