import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import BoxSelect, { selectionLabel } from "./BoxSelect";
const options = [{value:"current",label:"今月"},{value:"last",label:"先月"},{value:"year",label:"2026年度"}];
it("labels one, two and three selected periods", () => {
  expect(selectionLabel(["current"],options,"期間")).toBe("今月");
  expect(selectionLabel(["current","last"],options,"期間")).toBe("今月・先月");
  expect(selectionLabel(["current","last","year"],options,"期間")).toBe("3 つの期間");
});
it("applies multiple choices with Enter, disables empty selection and cancels drafts", () => {
  const change = vi.fn();
  render(<BoxSelect label="期間" value={["current"]} options={options} onChange={change} />);
  const open = () => fireEvent.click(screen.getByRole("button",{name:"期間"}));
  open(); fireEvent.click(screen.getByRole("button",{name:"すべて解除"}));
  expect(screen.getByRole("button",{name:"OK"})).toBeDisabled();
  fireEvent.submit(screen.getByRole("dialog")); expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText("今月")); fireEvent.click(screen.getByLabelText("先月"));
  fireEvent.keyDown(screen.getByLabelText("先月"),{key:"Enter"}); expect(change).toHaveBeenCalledWith(["current","last"]);
  open(); fireEvent.keyDown(document,{key:"Escape"}); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button",{name:"期間"})).toHaveFocus();
  open(); fireEvent.pointerDown(document.body); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("clamps the menu to a mobile viewport", () => {
  const width = window.innerWidth;
  Object.defineProperty(window,"innerWidth",{configurable:true,value:390});
  try {
    render(<BoxSelect label="期間" value={["current"]} options={options} onChange={() => {}} />);
    vi.spyOn(screen.getByRole("button",{name:"期間"}),"getBoundingClientRect").mockReturnValue({left:350,bottom:200} as DOMRect);
    fireEvent.click(screen.getByRole("button",{name:"期間"}));
    expect(parseFloat(screen.getByRole("dialog").style.left)+320).toBeLessThanOrEqual(382);
  } finally { Object.defineProperty(window,"innerWidth",{configurable:true,value:width}); }
});
