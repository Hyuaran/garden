import { expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-pathname": "/soil/product-points" }) }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(href); } }));
vi.mock("@/lib/auth/view-permission.server", () => {
  class ViewPermissionError extends Error {
    constructor(message: string, public status: number) { super(message); }
  }
  return {
    ViewPermissionError,
    viewPermissionContext: async () => { throw new ViewPermissionError("ログインし直してください。", 401); },
    canView: vi.fn(),
  };
});
vi.mock("./_components/SoilShell", () => ({ SoilShell: () => null }));

import Layout from "./layout";

it("未ログインは開こうとしたSoilのURLを戻り先にする", async () => {
  await expect(Layout({ children: null })).rejects.toThrow("/login?returnTo=%2Fsoil%2Fproduct-points");
});
