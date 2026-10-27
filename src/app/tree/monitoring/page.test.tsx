import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import MonitoringPage from "./page";
describe("monitoring tabs", () => {
  beforeEach(() => window.history.replaceState(null, "", "/tree/monitoring"));
  it("restores seats from the URL and keeps employee filters inside the list", () => {
    window.history.replaceState(null, "", "?tab=seat"); render(<MonitoringPage />);
    expect(screen.getByText("Aゾーン（トス）")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "全員" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "一覧" }));
    expect(screen.queryByText("Aゾーン（トス）")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "トス" }));
    expect(screen.queryByText("萩尾 拓也")).not.toBeInTheDocument();
    expect(screen.getByText("信田 優希")).toBeInTheDocument();
    expect(window.location.search).toBe("?tab=list");
    expect(screen.getAllByRole("tablist")).toHaveLength(1);
  });
});
