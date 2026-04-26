import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShojiStatusWidget } from "../ShojiStatusWidget";
import { ShojiStatusContext, type CeoStatus } from "../ShojiStatusContext";

function withCtx(ui: React.ReactNode, status: CeoStatus | null) {
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

describe("ShojiStatusWidget full", () => {
  it("renders full mode card with status, summary, and updated_by_name", () => {
    render(withCtx(<ShojiStatusWidget mode="full" />, {
      status: "focused",
      summary: "Root Phase B 確定中",
      updated_at: "2026-04-26T14:32:00Z",
      updated_by_name: "東海林美琴",
    }));
    expect(screen.getByText(/集中業務中/)).toBeInTheDocument();
    expect(screen.getByText("Root Phase B 確定中")).toBeInTheDocument();
    expect(screen.getByText(/東海林美琴/)).toBeInTheDocument();
  });
});

describe("ShojiStatusWidget stale color", () => {
  it("applies stale gray color when status is older than 30 minutes", () => {
    const thirtyOneMinutesAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    const { container } = render(withCtx(<ShojiStatusWidget mode="compact" />, {
      status: "available",
      summary: "OK",
      updated_at: thirtyOneMinutesAgo,
      updated_by_name: "東海林",
    }));
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    // inline style: color: stale ? "#888" : "inherit"
    expect(link?.getAttribute("style") ?? "").toMatch(/color:\s*(#888|rgb\(136,\s*136,\s*136\))/);
  });
  it("does NOT apply stale color when status is fresh (< 30 minutes)", () => {
    const justNow = new Date().toISOString();
    const { container } = render(withCtx(<ShojiStatusWidget mode="compact" />, {
      status: "available",
      summary: "OK",
      updated_at: justNow,
      updated_by_name: "東海林",
    }));
    const link = container.querySelector("a");
    expect(link?.getAttribute("style") ?? "").not.toMatch(/color:\s*(#888|rgb\(136,\s*136,\s*136\))/);
  });
});
