import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Loading from "./loading";

const css = readFileSync(
  resolve(
    process.cwd(),
    "src/app/_components/ShachoTransitionLoading/shacho-transition-loading.module.css",
  ),
  "utf8",
);

describe("System transition loading screen", () => {
  it("uses the Shacho light and dark page backgrounds", () => {
    expect(css).toMatch(/:global\(:root\) \.screen[^{]*\{[^}]*#f4f5f7/);
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)/);
    expect(css).toMatch(/:root:not\(\[data-theme="light"\]\)[^{]*\.screen[^{]*\{[^}]*#0c1726/);
    expect(css).toMatch(/:root\[data-theme="dark"\][^{]*\.screen[^{]*\{[^}]*#0c1726/);
    expect(css).toContain("min-height: 100dvh");
  });

  it("renders an empty full-screen surface without a spinner", () => {
    const { container } = render(<Loading />);
    expect(screen.getByTestId("shacho-transition-loading")).toBeEmptyDOMElement();
    expect(container.querySelector("[role='progressbar']")).not.toBeInTheDocument();
    expect(css).not.toMatch(/animation|spinner/i);
  });
});
