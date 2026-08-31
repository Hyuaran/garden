import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingAdminDetailClient from "./OnboardingAdminDetailClient";
import { initialAdminRecord } from "../../_lib/onboarding-admin";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("入社手続きの事務詳細", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let confirmMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    refresh.mockClear();
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
    confirmMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", confirmMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("従業員台帳への反映確認を画面内に出し、ブラウザ確認は使わない", async () => {
    const record = initialAdminRecord("EMP-001");
    render(<OnboardingAdminDetailClient record={record} />);

    fireEvent.click(screen.getByRole("button", { name: "従業員台帳に反映する" }));
    expect(confirmMock).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "従業員台帳への反映確認" })).toBeInTheDocument();
    expect(screen.getByText("従業員台帳に反映します。よろしいですか")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "やめる" }));
    expect(screen.queryByRole("group", { name: "従業員台帳への反映確認" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "従業員台帳に反映する" }));
    fireEvent.click(screen.getByRole("button", { name: "反映する" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.action).toBe("apply");
    expect(confirmMock).not.toHaveBeenCalled();
  });
});
