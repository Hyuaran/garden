import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const app = path.join(process.cwd(), "src/app");
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
const globalCss = readFileSync(path.join(app, "globals.css"), "utf8");
const cssFiles = files(app).filter(file => file.endsWith(".css"));

describe("画面の表の共通規則", () => {
  it("固定列も通常のセルも同じ一本の罫線を使う", () => {
    expect(globalCss).toMatch(/border-collapse:\s*separate\s*!important/);
    expect(globalCss).toMatch(/border-spacing:\s*0\s*!important/);
    expect(globalCss).toMatch(/border-right:\s*1px solid var\(--table-grid-line\)/);
    for (const file of cssFiles) {
      const css = readFileSync(file, "utf8");
      for (const block of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (/(?:\btd\b|\bth\b|\btable\b|\.tableWrap\b|\.stickyFirst\b)/i.test(block[1])) {
          expect(block[2], file + block[1]).not.toMatch(/box-shadow:[^;]*inset/);
        }
        if (/(?:td|th):first-child/.test(block[1]) && /position:\s*sticky/.test(block[2])) {
          expect(css + globalCss, file).toMatch(/border-collapse:\s*separate/);
        }
      }
    }
  });

  it("通常の表全体に縦の線と行ごとの交互の色があり、明暗の変数を持つ", () => {
    expect(globalCss).toContain("@media screen");
    // 行ごとに交互（列ごとではない・2026-11-12 東海林さん）。背景色は上書きしない（強調行などの色を消さない）
    expect(globalCss).toMatch(/tbody > tr:nth-child\(even\) > :is\(th, td\)\s*\{\s*background-image:\s*linear-gradient\(var\(--table-col-tint\)/);
    expect(globalCss).not.toMatch(/:is\(th, td\):nth-child\(even\)/);
    expect(globalCss).not.toMatch(/:nth-child\((?:even|odd)\)\s*\{\s*background-color/);
    expect(globalCss.match(/--table-col-tint:/g)?.length).toBe(3);
    expect(globalCss.match(/--table-grid-line:/g)?.length).toBe(3);
    expect(globalCss).toContain("prefers-color-scheme: dark");
  });
});
