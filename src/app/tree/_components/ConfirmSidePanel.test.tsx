import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ConfirmSidePanel } from "./ConfirmSidePanel";
function Panel() {
  const [active, select] = useState<string | null>("toss");
  return <ConfirmSidePanel activeTab={active} onTabSelect={select} confirmQueue={[]} tossQueue={[]} currentConfirmMode={null} onSelectItem={vi.fn()} onNavigate={vi.fn()} />;
}
it("switches the drawer content without changing the page URL", () => {
  window.history.replaceState(null, "", "/tree/call?tab=other");
  render(<Panel />);
  expect(screen.getByRole("button", { name: "クローザー待ち一覧を開く →" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "前後確" }));
  expect(screen.getByRole("button", { name: "前確・後確一覧を開く →" })).toBeInTheDocument();
  expect(screen.getAllByRole("tablist")).toHaveLength(1);
  expect(window.location.search).toBe("?tab=other");
});
