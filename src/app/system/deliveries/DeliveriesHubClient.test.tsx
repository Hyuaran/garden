import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import DeliveriesHubClient from "./DeliveriesHubClient";
import { SYSTEM_DELIVERIES } from "./_lib/deliveries-registry";

describe("DeliveriesHubClient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows call report delivery in list view by default", () => {
    render(<DeliveriesHubClient deliveries={SYSTEM_DELIVERIES} />);

    const breadcrumb = screen.getByRole("navigation", { name: "現在地" });
    expect(within(breadcrumb).getByRole("link", { name: "System" })).toHaveAttribute("href", "/system");
    expect(within(breadcrumb).getByText("自動配信")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "自動配信" })).toBeInTheDocument();
    expect(screen.getByTestId("deliveries-list-view")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "コール数配信" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "稼働中" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "開く" })).toHaveAttribute("href", "/system/call-metrics");
    expect(screen.getByRole("button", { name: "一覧表示にする" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switches to card view and saves the setting", () => {
    render(<DeliveriesHubClient deliveries={SYSTEM_DELIVERIES} />);

    fireEvent.click(screen.getByRole("button", { name: "カード表示にする" }));

    expect(screen.getByTestId("deliveries-grid-view")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "コール数配信" })).toBeInTheDocument();
    expect(screen.getByText("HR グループ【共有】")).toBeInTheDocument();
    expect(screen.getByText("稼働中")).toBeInTheDocument();
    expect(localStorage.getItem("garden.deliveries.viewMode")).toBe("grid");
  });

  it("restores the saved card view and can switch back to list", () => {
    localStorage.setItem("garden.deliveries.viewMode", "grid");
    render(<DeliveriesHubClient deliveries={SYSTEM_DELIVERIES} />);

    expect(screen.getByTestId("deliveries-grid-view")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "一覧表示にする" }));
    expect(screen.getByTestId("deliveries-list-view")).toBeInTheDocument();
    expect(localStorage.getItem("garden.deliveries.viewMode")).toBe("list");
  });
});
