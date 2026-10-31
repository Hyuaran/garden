import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ loading: false, isAuthenticated: false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(window.location.search), usePathname: () => "/root/employees" }));
vi.mock("../../_components/ModuleGate", () => ({
  ModuleGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../_state/RootStateContext", () => ({
  useRootState: () => state,
}));

import { RootGate } from "./RootGate";

describe("RootGate local lock", () => {
  it("初回だけ確認画面を出し、再確認中は中身を保持して失効時に案内する", () => {
    state.loading = true; state.isAuthenticated = false;
    const { rerender } = render(<RootGate><div>Root内容</div></RootGate>);
    expect(screen.getByRole("status")).toHaveTextContent("利用状況を確認しています...");
    expect(screen.getByRole("status").querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("status").textContent ?? "").not.toMatch(/\p{Extended_Pictographic}/u);
    state.loading = false; state.isAuthenticated = true;
    rerender(<RootGate><div>Root内容</div></RootGate>);
    state.loading = true;
    rerender(<RootGate><div>Root内容</div></RootGate>);
    expect(screen.getByText("Root内容")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    state.loading = false; state.isAuthenticated = false;
    rerender(<RootGate><div>Root内容</div></RootGate>);
    expect(screen.getByRole("heading", { name: "もう一度ログインしてください" })).toBeInTheDocument();
  });
  it("Rootがロックされたら再ログイン案内を表示する", () => {
    render(<RootGate><div>Root内容</div></RootGate>);

    expect(screen.getByRole("heading", { name: "もう一度ログインしてください" })).toBeInTheDocument();
    expect(screen.queryByText("Root内容")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute(
      "href",
      "/root/login?returnTo=%2Froot%2Femployees&reason=expired",
    );
    expect(screen.queryByText(/session|timeout|RLS/i)).not.toBeInTheDocument();
  });
});
