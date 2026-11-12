import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OnboardingAdminDetailClient from "./OnboardingAdminDetailClient";
vi.mock("../../_components/AdminTemplates", () => ({ default: () => null }));
import { initialAdminRecord } from "../../_lib/onboarding-admin";
import { emptyDependent } from "../../_lib/onboarding";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());
function record() {
  const row = initialAdminRecord("EMP-1");
  row.status = "submitted";
  row.values.dependents = [{ ...emptyDependent(), name: "家族" }];
  return row;
}
describe("扶養家族の事務修正", () => {
  it("閲覧だけの人には修正も番号入力も出ない", () => {
    render(<OnboardingAdminDetailClient record={record()} canWrite={false} sensitive />);
    expect(screen.queryByRole("button", { name: /修正|マイナンバーを入れる/ })).not.toBeInTheDocument();
  });
  it("責任者は収入・職業を修正できるが番号入力は出ない", () => {
    render(<OnboardingAdminDetailClient record={record()} />);
    expect(screen.getByRole("button", { name: "扶養家族1人目の年間収入を修正" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "扶養家族1人目の職業または学校と学年を修正" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /マイナンバーを入れる/ })).not.toBeInTheDocument();
  });
  it("番号を伏せて入力し、保存後に平文を消し、再入力では上書きを確認する", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ value: "••••••••9018" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<OnboardingAdminDetailClient record={record()} sensitive />);
    fireEvent.click(screen.getByRole("button", { name: /マイナンバーを入れる/ }));
    const input = screen.getByLabelText("扶養家族1人目のマイナンバー");
    expect(input).toHaveAttribute("type", "password");
    fireEvent.change(input, { target: { value: "123456789018" } });
    fireEvent.click(screen.getByRole("button", { name: "扶養家族1人目のマイナンバーを保存" }));
    await waitFor(() => expect(input).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue("123456789018")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "見る" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "扶養家族1人目のマイナンバーを修正" }));
    fireEvent.change(screen.getByLabelText("扶養家族1人目のマイナンバー"), { target: { value: "123456789018" } });
    fireEvent.click(screen.getByRole("button", { name: "扶養家族1人目のマイナンバーを保存" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("checkbox", { name: /上書きします/ }));
    fireEvent.click(screen.getByRole("button", { name: "扶養家族1人目のマイナンバーを保存" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).overwrite).toBe(true);
  });
});
