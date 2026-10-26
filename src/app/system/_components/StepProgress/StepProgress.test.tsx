import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import StepProgress from "./StepProgress";

it("30件までは1件1マス、31件から連続した線に切り替える", () => {
  const { container, rerender } = render(<StepProgress total={30} value={6} name="進捗" label="残り24件"/>);
  expect(container.querySelectorAll("[data-step-status]")).toHaveLength(30);
  expect(container.querySelectorAll('[data-step-status="answered"]')).toHaveLength(6);
  rerender(<StepProgress total={31} value={31} name="進捗" label="残りなし"/>);
  expect(container.querySelectorAll("[data-step-status]")).toHaveLength(0);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "31");
  expect(container.querySelector('[style="width: 100%;"]')).toBeInTheDocument();
});
