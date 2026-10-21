import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import HeaderViewToggle, { HeaderViewProvider, HeaderViewSlot } from "./HeaderViewToggle";

afterEach(() => vi.unstubAllGlobals());
it.each([false, true])("moves controls to the active header and removes them on navigation (mobile=%s)", async (mobile) => {
  vi.stubGlobal("matchMedia", () => ({ matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  function Page() {
    const [grid, setGrid] = useState(false);
    return <HeaderViewToggle><button aria-pressed={grid} onClick={() => setGrid(!grid)}>切り替える</button></HeaderViewToggle>;
  }
  const shell = (show: boolean) => <HeaderViewProvider>
    <header data-testid="desktop"><HeaderViewSlot /></header>
    <header data-testid="mobile"><HeaderViewSlot mobile /></header>
    {show && <Page />}
  </HeaderViewProvider>;
  const { rerender } = render(shell(true));
  await waitFor(() => expect(within(screen.getByTestId(mobile ? "mobile" : "desktop")).queryByRole("button", { name: "この画面は表示の切り替えがありません" })).not.toBeInTheDocument());
  const button = within(screen.getByTestId(mobile ? "mobile" : "desktop")).getByRole("button");
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-pressed", "true");
  rerender(shell(false));
  await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(2));
  for (const fallback of screen.getAllByRole("button")) {
    expect(fallback).toBeDisabled();
    expect(fallback).toHaveAccessibleName("この画面は表示の切り替えがありません");
  }
});
