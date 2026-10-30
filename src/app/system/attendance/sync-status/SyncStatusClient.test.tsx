import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SyncStatusClient from "./SyncStatusClient";

describe("SyncStatusClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the confirmed System and attendance label", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    render(<SyncStatusClient />);
    const breadcrumb = screen.getByRole("navigation", { name: "現在地" });
    expect(within(breadcrumb).getByRole("link", { name: "System" })).toHaveAttribute("href", "/system");
    expect(within(breadcrumb).getByRole("link", { name: "勤怠打刻" })).toHaveAttribute("href", "/system/attendance");
    expect(within(breadcrumb).getByText("同期状況")).toBeInTheDocument();
    expect(screen.queryByText("SYSTEM / ATTENDANCE")).not.toBeInTheDocument();
  });
});
