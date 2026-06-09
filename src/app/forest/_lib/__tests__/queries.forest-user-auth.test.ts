import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  const getUserMock = vi.fn();
  return { maybeSingleMock, eqMock, selectMock, fromMock, getUserMock };
});

vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      getUser: mocks.getUserMock,
    },
    from: mocks.fromMock,
  },
}));

import { fetchForestUser } from "../queries";

describe("fetchForestUser auth timing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("confirms auth user before querying forest_users", async () => {
    mocks.getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    mocks.maybeSingleMock.mockResolvedValue({
      data: {
        user_id: "u1",
        employee_number: "0001",
        role: "admin",
        approved_by: null,
        approved_at: null,
        created_at: "2026-01-01",
      },
      error: null,
    });

    const result = await fetchForestUser("u1");

    expect(result?.user_id).toBe("u1");
    expect(mocks.getUserMock).toHaveBeenCalledBefore(mocks.fromMock as Mock);
    expect(mocks.fromMock).toHaveBeenCalledWith("forest_users");
  });

  it("does not query forest_users when auth user is missing", async () => {
    mocks.getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await fetchForestUser("u1");

    expect(result).toBeNull();
    expect(mocks.fromMock).not.toHaveBeenCalled();
  });
});
