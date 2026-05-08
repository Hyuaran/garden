import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TodaysActivity } from "../TodaysActivity";

afterEach(() => {
  vi.clearAllMocks();
});

describe("TodaysActivity — initial render", () => {
  it("renders 5 mock activity items", () => {
    render(<TodaysActivity />);
    const aside = screen.getByTestId("todays-activity");
    expect(aside).toBeInTheDocument();
    const items = aside.querySelectorAll('[data-testid^="activity-item-"]');
    expect(items.length).toBe(5);
  });

  it("shows expected mock titles", () => {
    render(<TodaysActivity />);
    expect(screen.getByText("売上レポートが更新されました")).toBeInTheDocument();
    expect(screen.getByText("入金がありました")).toBeInTheDocument();
    expect(screen.getByText("新しいタスクが割り当てられました")).toBeInTheDocument();
    expect(screen.getByText("ワークフロー申請が承認されました")).toBeInTheDocument();
    expect(screen.getByText("システムからのお知らせ")).toBeInTheDocument();
  });

  it("includes view-all link to /bloom/activity", () => {
    render(<TodaysActivity />);
    const link = screen.getByTestId("todays-activity-view-all");
    expect(link.getAttribute("href")).toBe("/bloom/activity");
  });

  it("includes close button", () => {
    render(<TodaysActivity />);
    expect(screen.getByTestId("todays-activity-close")).toBeInTheDocument();
  });
});

describe("TodaysActivity — toggle behavior", () => {
  it("close button hides the panel", () => {
    render(<TodaysActivity />);
    expect(screen.getByTestId("todays-activity")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("todays-activity-close"));
    expect(screen.queryByTestId("todays-activity")).toBeNull();
  });

  it("re-opens via garden:activity:toggle CustomEvent", () => {
    render(<TodaysActivity />);
    // close first
    fireEvent.click(screen.getByTestId("todays-activity-close"));
    expect(screen.queryByTestId("todays-activity")).toBeNull();
    // dispatch toggle event from window
    act(() => {
      window.dispatchEvent(new CustomEvent("garden:activity:toggle"));
    });
    expect(screen.getByTestId("todays-activity")).toBeInTheDocument();
  });
});
