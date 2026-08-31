import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(resolve(process.cwd(), `src/app/system/docs/${path}`), "utf8");
describe("動画画面の社長スタイル", () => {
  it("固定背景を持つ資料のpageShellを共有し、動画のCSSだけを追加する", () => {
    expect(read("videos/page.tsx")).toContain('import styles from "../docs.module.css"');
    expect(read("videos/page.tsx")).toContain("className={styles.pageShell}");
    expect(read("docs.module.css")).toContain('.pageShell::before{content:"";position:fixed;inset:0;z-index:-1;background:var(--bg)}');
    const css = read("videos/videos.module.css");
    expect(css).toContain("aspect-ratio:16/9"); expect(css).toContain("object-fit:cover");
    expect(css).toContain("color:var(--heading)"); expect(css).toContain("minmax(0,1fr)");
    expect(css).not.toContain(":global");
  });
});
