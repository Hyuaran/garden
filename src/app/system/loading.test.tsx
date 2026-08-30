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
  it("stays inside the shared shell content area", () => {
    expect(css).toContain("min-height: min(240px, 35vh)");
    expect(css).toContain("background: transparent");
    expect(css).not.toContain("100dvh");
    expect(css).not.toMatch(/#f4f5f7|#0c1726/);
  });

  it("renders an empty content placeholder without a spinner", () => {
    const { container } = render(<Loading />);
    expect(screen.getByTestId("shacho-transition-loading")).toBeEmptyDOMElement();
    expect(container.querySelector("[role='progressbar']")).not.toBeInTheDocument();
    expect(css).not.toMatch(/animation|spinner/i);
  });
});
