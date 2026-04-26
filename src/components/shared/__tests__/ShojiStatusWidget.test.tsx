import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShojiStatusWidget } from "../ShojiStatusWidget";
import { ShojiStatusContext } from "../ShojiStatusContext";

function withCtx(ui: React.ReactNode, status: any) {
  return (
    <ShojiStatusContext.Provider value={{ status, loading: false, error: null, refresh: async () => {} }}>
      {ui}
    </ShojiStatusContext.Provider>
  );
}

describe("ShojiStatusWidget compact", () => {
  it("renders status icon + label + summary", () => {
    render(withCtx(<ShojiStatusWidget mode="compact" />, {
      status: "busy", summary: "Root Phase B", updated_at: new Date().toISOString(), updated_by_name: "東海林",
    }));
    expect(screen.getByText(/取り込み中/)).toBeInTheDocument();
    expect(screen.getByText(/Root Phase B/)).toBeInTheDocument();
  });
  it("renders 'メモなし' when summary is null", () => {
    render(withCtx(<ShojiStatusWidget mode="compact" />, {
      status: "available", summary: null, updated_at: new Date().toISOString(), updated_by_name: "東海林",
    }));
    expect(screen.getByText(/メモなし/)).toBeInTheDocument();
  });
  it("renders skeleton when status is null", () => {
    render(withCtx(<ShojiStatusWidget mode="compact" />, null));
    expect(screen.getByTestId("ceo-status-skeleton")).toBeInTheDocument();
  });
});
