import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import OnboardingClient from "./OnboardingClient";
import { emptyInput, STEPS } from "./_lib/onboarding";

afterEach(() => vi.unstubAllGlobals());
async function advance(step: number) {
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
  await screen.findByRole("heading", { name: STEPS[step] });
}
it("責任者の代行画面は固定帯を出し、口座・番号の画面と確認に機微欄を出さない", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "draft" }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<OnboardingClient initial={{ values: emptyInput(), status: "draft", ndaAgreedAt: null, submittedAt: null }}
    proxy={{ employeeId: "EMP-1", employeeName: "後道 愛美", actorName: "東海林 美琴", sensitive: false }} />);
  expect(screen.getByText(/代行入力中：後道 愛美/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "代行をやめる" })).toBeInTheDocument();
  for (let step = 1; step <= 6; step++) {
    await advance(step);
    if (step === 2) {
      fireEvent.change(screen.getByLabelText("扶養している家族はいますか"), { target: { value: "yes" } });
      expect(screen.queryByLabelText("マイナンバー（12桁）")).toBeNull();
    }
  }
  expect(screen.getByText("この画面は全権管理者だけが代わりに入力できます")).toBeInTheDocument();
  expect(screen.queryByLabelText("銀行名")).toBeNull();
  const saved = fetchMock.mock.calls.length;
  await advance(7);
  expect(screen.queryByLabelText("マイナンバー（12桁）")).toBeNull();
  await advance(8);
  expect(fetchMock).toHaveBeenCalledTimes(saved);
  await advance(9); await advance(10);
  const review = screen.getByRole("region", { name: "給与の受取口座" });
  expect(within(review).queryByText("口座番号（8桁以内）")).toBeNull();
  for (const [url, init] of fetchMock.mock.calls) {
    expect(url).toBe("/api/system/onboarding/admin/EMP-1/proxy");
    const body = JSON.parse(init.body);
    expect(body.values).not.toHaveProperty("my_number");
    expect(body.values).not.toHaveProperty("account_number");
    for (const dependent of body.values.dependents) expect(dependent).not.toHaveProperty("my_number");
  }
});
it("全権管理者の代行では口座と番号を入力できる", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "draft" }) }));
  render(<OnboardingClient initial={{ values: emptyInput(), status: "draft", ndaAgreedAt: null, submittedAt: null }}
    proxy={{ employeeId: "EMP-1", employeeName: "後道 愛美", actorName: "全権", sensitive: true }} />);
  for (let step = 1; step <= 6; step++) await advance(step);
  expect(screen.getByLabelText("銀行名")).toBeInTheDocument();
  await advance(7);
  expect(screen.getByLabelText("マイナンバー（12桁）")).toBeInTheDocument();
});
