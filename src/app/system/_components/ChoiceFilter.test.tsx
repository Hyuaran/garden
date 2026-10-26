import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ChoiceFilter from "./ChoiceFilter";

afterEach(cleanup);

it("keeps the all option and applies a single filter only after OK", () => {
  const change = vi.fn();
  render(<ChoiceFilter label="法人" value="" onValueChange={change}>
    <option value="">すべて</option>
    <><option value="first">ヒュアラン</option><option value="second">センターライズ</option></>
  </ChoiceFilter>);
  fireEvent.click(screen.getByRole("button", { name: "法人" }));
  fireEvent.click(screen.getByRole("radio", { name: "センターライズ" }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(change).toHaveBeenCalledWith("second");
});

it("disables the trigger while the filter is unavailable", () => {
  render(<ChoiceFilter label="法人" value="" onValueChange={() => {}} disabled><option value="">すべて</option></ChoiceFilter>);
  expect(screen.getByRole("button", { name: "法人" })).toBeDisabled();
});
