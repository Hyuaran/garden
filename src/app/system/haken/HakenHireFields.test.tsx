import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import HakenHireFields from "./HakenHireFields";
import {
  isHireFieldRequired,
  parseHireInput,
} from "@/app/system/onboarding/_lib/hire-candidates";
vi.mock("./IssueButtons", () => ({
  default: () => <p>書類をダウンロードする</p>,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("派遣の必須欄を表示し、親の再描画では再取得しない", async () => {
  const fetch = vi.fn(async () =>
    Response.json({ parties: [{ id: "p", name: "A社" }] }),
  );
  vi.stubGlobal("fetch", fetch);
  const change = vi.fn();
  const props = {
    partyId: "",
    start: "2026-09-11",
    end: "",
    onPartyChange: change,
    onEndChange: change,
    onError: change,
  };
  const view = render(<HakenHireFields {...props} />);
  await waitFor(() =>
    expect(screen.getByRole("option", { name: "A社" })).toBeInTheDocument(),
  );
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "p" } });
  expect(change).toHaveBeenCalledWith("p");
  view.rerender(<HakenHireFields {...props} onError={() => {}} />);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("combobox")).toBeRequired();
});
it("派遣だけ派遣会社・終了日を必須にし、他の雇用形態に増やさない", () => {
  for (const type of ["正社員", "アルバイト", "役員", "パートナー"]) {
    expect(isHireFieldRequired("haken_party_id", type)).toBe(false);
    expect(isHireFieldRequired("haken_period_end", type)).toBe(false);
  }
  expect(isHireFieldRequired("haken_party_id", "派遣")).toBe(true);
  expect(isHireFieldRequired("haken_period_end", "派遣")).toBe(true);
  const base = {
    last_name: "社員",
    first_name: "A",
    last_name_kana: "シャイン",
    first_name_kana: "エー",
    birthday: "2000-01-01",
    gender: "male",
    hire_date: "2026-09-11",
    company_id: "c",
    kot_division_code: "1",
    kot_type_code: "2",
  };
  expect(
    parseHireInput({ ...base, employment_type: "正社員" }),
  ).not.toHaveProperty("haken_party_id");
  expect(() => parseHireInput({ ...base, employment_type: "派遣" })).toThrow(
    "派遣会社と終了日",
  );
});
