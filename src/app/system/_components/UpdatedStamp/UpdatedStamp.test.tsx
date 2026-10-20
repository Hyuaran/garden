import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UpdatedStamp, { UpdatedStampRow } from "./UpdatedStamp";
import { formatSyncStamp } from "./formatSyncStamp";

describe("UpdatedStamp", () => {
  it("formats Japan time including midnight and the weekday", () => {
    expect(formatSyncStamp("2026-10-20T10:59:00Z")).toBe("2026/10/20(火) 19:59");
    expect(formatSyncStamp(new Date("2026-10-19T15:00:00Z"))).toBe("2026/10/20(火) 00:00");
    expect(formatSyncStamp("invalid")).toBe("");
  });
  it("calls refresh and prevents repeated clicks while busy", () => {
    const refresh = vi.fn();
    const { rerender } = render(<UpdatedStampRow><UpdatedStamp label="MF" date="2026-10-20T10:59:00Z" onRefresh={refresh} refreshLabel="読み直す" title="読み直す（1分に1回まで）" /></UpdatedStampRow>);
    expect(screen.getByText("MF最終更新：2026/10/20(火) 19:59")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "読み直す" });
    expect(button).toHaveAttribute("title", "読み直す（1分に1回まで）");
    fireEvent.click(button);
    expect(refresh).toHaveBeenCalledTimes(1);
    rerender(<UpdatedStamp label="MF" busy onRefresh={refresh} refreshLabel="読み直す" />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button").querySelector("svg")).toHaveAttribute("class");
    fireEvent.click(screen.getByRole("button"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it("keeps the caller's empty message and disables refresh when unavailable", () => {
    render(<UpdatedStamp label="受注履歴" emptyText="未反映" />);
    expect(screen.getByText("受注履歴最終更新：未反映")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute("title", "自動で更新されます（手動の取り直しはできません）");
  });
});
