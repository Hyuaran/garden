import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageHeader } from "./PageHeader";

const route = vi.hoisted(() => ({ pathname: "/root/companies" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(window.location.search), usePathname: () => route.pathname }));

describe("Root の見出し", () => {
  it("現在地と30pxの見出しを表示し、説明文を出さない", () => {
    render(<PageHeader title="法人マスタ" description="説明文" />);
    const breadcrumb = screen.getByRole("navigation", { name: "現在地" });
    expect(within(breadcrumb).getByRole("link", { name: "Root" })).toHaveAttribute("href", "/root");
    expect(within(breadcrumb).getByText("法人マスタ")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveStyle({ fontSize: "30px" });
    expect(screen.queryByText("説明文")).not.toBeInTheDocument();
  });

  it("トップの現在地はRootへのリンクだけを表示する", () => {
    route.pathname = "/root";
    render(<PageHeader title="マスタ管理" />);
    const breadcrumb = screen.getByRole("navigation", { name: "現在地" });
    expect(breadcrumb).toHaveTextContent(/^Root$/);
    expect(within(breadcrumb).getByRole("link")).toHaveAttribute("href", "/root");
  });
});
