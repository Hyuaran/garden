import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import PageHeader from "./PageHeader";

afterEach(() => localStorage.clear());

it("keeps the expense favorite outlined when adding and removing it", () => {
  render(<PageHeader title="経費精算" outlineFavorite />);
  const button = screen.getByRole("button", { name: "このページをお気に入りに追加" });
  const assertOutline = () => {
    expect(button.querySelector("img")).toBeNull();
    expect(button.querySelector("svg")).toHaveAttribute("fill", "none");
    expect(button.querySelector("svg")).toHaveAttribute("stroke", "currentColor");
    expect(button.textContent).not.toMatch(/[\u2605\u2606]|\p{Extended_Pictographic}/u);
  };
  assertOutline();
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-pressed", "true");
  expect(JSON.parse(localStorage.getItem("garden_favorites")!)).toHaveLength(1);
  assertOutline();
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-pressed", "false");
  expect(JSON.parse(localStorage.getItem("garden_favorites")!)).toHaveLength(0);
  assertOutline();
});
