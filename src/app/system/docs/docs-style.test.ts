import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const css = readFileSync(resolve(process.cwd(), "src/app/system/docs/docs.module.css"), "utf8");
describe("資料専用の社長スタイル", () => {
  it("長い本文でも固定背景とゴシックを維持する", () => {
    expect(css).toContain('.pageShell::before{content:"";position:fixed;inset:0;z-index:-1;background:var(--bg)}');
    expect(css).toContain('font-family:"Meiryo"');
    expect(css).toContain("--bg:#f4f5f7");
    expect(css).not.toContain("--bg-paper-soft");
  });
  it("ダークでは濃紺から独立した見出し色・本文・補助色を持つ", () => {
    expect(css).toContain('--heading:#c8d6ea; --ink:#edf4fb; --sub:#b7c5d4');
    expect(css).toContain('color:var(--heading)');
  });
  it("375px対応は資料の範囲内で行い、共通サイドバーを変更しない", () => {
    expect(css).toContain("@media (max-width:640px)");
    expect(css).toContain(":global(main):has(.pageShell) { overflow-x:clip; }");
    expect(css).not.toContain(".side");
    expect(css).not.toContain(".rail");
  });
  it("組織図はCSSの接続線を持ち900px以下では縦に切り替わる", () => {
    expect(css).toContain(".orgChildren { display:flex;");
    expect(css).toContain("border-left:2px solid var(--org-line)");
    expect(css).toContain("border-top:2px solid var(--org-line)");
    expect(css).toContain("@media (max-width:900px)");
    expect(css).toContain(".orgChildren { display:block;");
    expect(css).toContain("max-width:1560px");
  });
  it("氏名はnowrapで箱幅に収め、部署と人物の色・枠を区別する", () => {
    expect(css).toContain("white-space:nowrap");
    expect(css).toContain("container-type:inline-size");
    expect(css).toContain("font-size:min(15px,calc(100cqi / var(--org-name-length)))");
    expect(css).toContain("border:2px solid var(--org-department-line)");
    expect(css).toContain("background:var(--org-member-bg)");
  });
});
