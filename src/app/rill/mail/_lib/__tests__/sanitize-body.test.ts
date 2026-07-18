import { describe, expect, it } from "vitest";
import { sanitizeMailHtml } from "../sanitize-body";

describe("Rill Mail HTML body sanitization", () => {
  it("forces safe new-tab attributes on links", () => {
    const html = sanitizeMailHtml('<a href="https://example.com" target="_self" rel="opener">開く</a>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("removes unsafe href values while retaining safe mail content", () => {
    const html = sanitizeMailHtml('<a href="javascript:alert(1)">危険</a><p>本文</p>');
    expect(html).not.toContain("javascript:");
    expect(html).toContain("<p>本文</p>");
  });
});
