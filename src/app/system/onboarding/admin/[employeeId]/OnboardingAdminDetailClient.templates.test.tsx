import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import OnboardingAdminDetailClient from "./OnboardingAdminDetailClient";
import { initialAdminRecord } from "../../_lib/onboarding-admin";
afterEach(() => vi.unstubAllGlobals());
it("NHK社員のひな形を事務欄へ入れても保存せず、交通費の支給額を再計算する", async () => {
  const fetchMock = vi.fn(async () => Response.json([{ id: "nhk", name: "NHK社員", sort_order: 3, updated_at: "now", values: { office: "大阪本社", weekly_hours: "40", health_insurance: "加入", pension_insurance: "加入", employment_insurance: "加入", tax_class: "甲", salary_kind: "月給", base_salary: "260000", allowances: [], commute_cap_monthly: "15000" } }]));
  vi.stubGlobal("fetch", fetchMock);
  const record = initialAdminRecord("EMP-1");
  record.values.commute_routes = [{ kind: "電車", from_station: "A", to_station: "B", line: "線", pass_monthly: "12000", fare_oneway: "500" }];
  render(<OnboardingAdminDetailClient record={record} />);
  fireEvent.click(await screen.findByRole("button", { name: "NHK社員" }));
  expect(screen.getByLabelText("所属店舗")).toHaveValue("大阪本社");
  expect(screen.getByLabelText("基本給（円）")).toHaveValue("260000");
  expect(screen.getByLabelText("交通費の上限（1か月・円）")).toHaveValue("15000");
  expect(screen.getByLabelText(/支給額（1か月・円）/)).toHaveValue("12000");
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
});
