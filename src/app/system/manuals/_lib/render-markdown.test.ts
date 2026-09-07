import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./render-markdown";

describe("renderMarkdown", () => {
  it("renders a small safe subset", () => {
    expect(renderMarkdown("# 見出し\n\n- **太字**\n- `code`\n\n[link](https://example.com)")).toContain("<h1>見出し</h1>");
    expect(renderMarkdown("- **太字**")).toContain("<strong>太字</strong>");
    expect(renderMarkdown("`code`")).toContain("<code>code</code>");
    expect(renderMarkdown("[link](https://example.com)")).toContain('href="https://example.com"');
  });

  it("escapes html before rendering", () => {
    expect(renderMarkdown("<script>alert(1)</script>")).toContain("&lt;script&gt;");
    expect(renderMarkdown("```html\n<div>x</div>\n```")).toContain("&lt;div&gt;x&lt;/div&gt;");
  });
});
