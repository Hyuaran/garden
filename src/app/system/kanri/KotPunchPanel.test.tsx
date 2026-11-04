import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import KotPunchPanel from "./KotPunchPanel";
afterEach(() => vi.unstubAllGlobals());
it("keeps the import gate closed until every person is closed and never reads closing on mount", async () => {
  const gate = vi.fn();
  const fetch = vi.fn(async (url: string) =>
    Response.json(
      url.includes("kot-send")
        ? { startDate: null, rows: [] }
        : {
            confirmed: false,
            rows: [{ employeeKey: "1", name: "社員", isClosing: false }],
          },
    ),
  );
  vi.stubGlobal("fetch", fetch);
  render(<KotPunchPanel date="2026-11-03" onGate={gate} />);
  expect(
    await screen.findByText("打刻は KING OF TIME で直接行っています。"),
  ).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(gate).toHaveBeenLastCalledWith(false);
  fireEvent.click(screen.getByRole("button", { name: "締めを確かめる" }));
  await screen.findByText(/締めずみ 0人/);
  expect(gate).toHaveBeenLastCalledWith(false);
  fetch.mockImplementation(async () =>
    Response.json({
      confirmed: true,
      rows: [{ employeeKey: "1", name: "社員", isClosing: true }],
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "締めを確かめる" }));
  await waitFor(() => expect(gate).toHaveBeenLastCalledWith(true));
});
it("requires an explicit confirmation before bypassing an unavailable closing check", async () => {
  const gate = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("kot-send")
        ? Response.json({ startDate: null, rows: [] })
        : Response.json({ error: "中継が止まっています" }, { status: 400 }),
    ),
  );
  render(<KotPunchPanel date="2026-11-03" onGate={gate} />);
  fireEvent.click(screen.getByRole("button", { name: "締めを確かめる" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "確かめずに進む" }),
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(gate).toHaveBeenLastCalledWith(false);
  fireEvent.click(
    screen.getAllByRole("button", { name: "確かめずに進む" }).at(-1)!,
  );
  expect(gate).toHaveBeenLastCalledWith(true);
});
