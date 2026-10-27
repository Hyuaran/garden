import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import KandenPrototypePage from "./KandenPrototypePage";
vi.mock("./LeafShell", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
it("changes iframe source and restores the selected input tab", () => {
  window.history.replaceState(null, "", "/leaf/kanden/input");
  const view = render(<KandenPrototypePage mode="input" />);
  const tabs = screen.getAllByRole("tab");
  expect(tabs).toHaveLength(3);
  const iframe = () => document.querySelector("iframe")!;
  const before = iframe().getAttribute("src");
  fireEvent.click(tabs[0]);
  expect(iframe().getAttribute("src")).not.toBe(before);
  const source = iframe().getAttribute("src");
  view.unmount(); render(<KandenPrototypePage mode="input" />);
  expect(iframe().getAttribute("src")).toBe(source);
  expect(screen.getAllByRole("tablist")).toHaveLength(1);
});
