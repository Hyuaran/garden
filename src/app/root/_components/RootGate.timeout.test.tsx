import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/root/employees" }));
vi.mock("../../_components/ModuleGate", () => ({
  ModuleGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../_state/RootStateContext", () => ({
  useRootState: () => ({ loading: false, isAuthenticated: false }),
}));

import { RootGate } from "./RootGate";

describe("RootGate local lock", () => {
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
