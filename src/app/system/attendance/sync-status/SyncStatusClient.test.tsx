import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SyncStatusClient from "./SyncStatusClient";

describe("SyncStatusClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the confirmed System and attendance label", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    render(<SyncStatusClient />);
    expect(screen.getByText("System ／ 勤怠打刻")).toBeInTheDocument();
    expect(screen.queryByText("SYSTEM / ATTENDANCE")).not.toBeInTheDocument();
  });
});
