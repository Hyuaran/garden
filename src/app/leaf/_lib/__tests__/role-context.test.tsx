/**
 * RoleProvider / useGardenRole のテスト。
 * RTL で mount 時の RPC 取得 + null → role 反映を確認。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RoleProvider, useGardenRole } from "../role-context";

vi.mock("@/lib/supabase/client", () => {
  const supabase = (
    globalThis as unknown as { __mockClient?: unknown }
  ).__mockClient;
  return {
    getSupabaseClient: () => supabase,
    supabase,
  };
});

import { createLeafSupabaseMock } from "@/test-utils/leaf-supabase-mock";

function Probe() {
  const role = useGardenRole();
  return <span data-testid="role-display">{role ?? "loading"}</span>;
}

describe("RoleProvider / useGardenRole", () => {
  beforeEach(() => {
    const m = createLeafSupabaseMock();
    // デフォルトで認証済みユーザー想定: user.id = 'u1'
    m.auth.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    m.helpers.setRoleResponse("super_admin");
    (globalThis as unknown as { __mockClient: unknown }).__mockClient =
      m.client;
  });

  it("returns null while loading (initial render)", () => {
    render(
      <RoleProvider>
        <Probe />
      </RoleProvider>,
    );
    // 初回 render では useEffect が走る前 = loading 状態
    expect(screen.getByTestId("role-display").textContent).toBe("loading");
  });

  it("resolves role after Supabase RPC returns", async () => {
    render(
      <RoleProvider>
        <Probe />
      </RoleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("role-display").textContent).toBe(
        "super_admin",
      );
    });
  });

  it("propagates 'manager' role correctly", async () => {
    const m = createLeafSupabaseMock();
    m.auth.getUser.mockResolvedValue({
      data: { user: { id: "u-manager" } },
      error: null,
    });
    m.helpers.setRoleResponse("manager");
    (globalThis as unknown as { __mockClient: unknown }).__mockClient =
      m.client;

    render(
      <RoleProvider>
        <Probe />
      </RoleProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("role-display").textContent).toBe("manager");
    });
  });

  it("stays loading when no user (unauthenticated)", async () => {
    const m = createLeafSupabaseMock();
    m.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    (globalThis as unknown as { __mockClient: unknown }).__mockClient =
      m.client;

    render(
      <RoleProvider>
        <Probe />
      </RoleProvider>,
    );

    // 短い待機で状態確定
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId("role-display").textContent).toBe("loading");
  });
});
