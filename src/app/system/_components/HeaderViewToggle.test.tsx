import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import HeaderViewToggle, { HeaderViewProvider, HeaderViewSlot } from "./HeaderViewToggle";

afterEach(() => vi.unstubAllGlobals());
it.each([false, true])("moves controls to the active header and removes them on navigation (mobile=%s)", (mobile) => {
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
  const button = within(screen.getByTestId(mobile ? "mobile" : "desktop")).getByRole("button");
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-pressed", "true");
  rerender(shell(false));
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
