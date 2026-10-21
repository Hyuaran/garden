import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import BoxSelect, { selectionLabel } from "./BoxSelect";
const options = [{value:"current",label:"今月"},{value:"last",label:"先月"},{value:"year",label:"2026年度"}];
it("uses exclusive radio selection without bulk actions", () => {
  const change=vi.fn();render(<BoxSelect label="並び順" multiple={false} value={["current"]} options={options} onChange={change} />);
  fireEvent.click(screen.getByRole("button",{name:"並び順"}));
  expect(screen.queryByRole("button",{name:"すべて解除"})).toBeNull();
  fireEvent.click(screen.getByRole("radio",{name:"先月"}));fireEvent.click(screen.getByRole("button",{name:"OK"}));
  expect(change).toHaveBeenCalledWith(["last"]);
});
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
it("switches the clear button to select all when nothing is checked", () => {
  const change = vi.fn();
  render(<BoxSelect label="期間" value={["current"]} options={[{value:"a",label:"A"},{value:"b",label:"B"},{value:"current",label:"C"}]} onChange={change} />);
  fireEvent.click(screen.getByRole("button",{name:"期間"}));
  fireEvent.click(screen.getByRole("button",{name:"すべて解除"}));
  fireEvent.click(screen.getByRole("button",{name:"すべて選択"}));
  fireEvent.submit(screen.getByRole("dialog"));
  expect(change).toHaveBeenCalledWith(["a","b","current"]);
});

it.each([0.9, 1, 1.15])("positions the menu in CSS coordinates at zoom %s", zoom => {
  document.documentElement.style.zoom = String(zoom);
  try {
    render(<BoxSelect label="zoom-test" value={["current"]} options={options} onChange={() => {}} />);
    const button = screen.getByRole("button", { name: "zoom-test" });
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({ left: 100 * zoom, bottom: 150 * zoom } as DOMRect);
    fireEvent.click(button);
    expect(parseFloat(screen.getByRole("dialog").style.left)).toBeCloseTo(100);
    expect(parseFloat(screen.getByRole("dialog").style.top)).toBeCloseTo(154);
    fireEvent(window, new Event("garden-font-size-change"));
    expect(screen.queryByRole("dialog")).toBeNull();
  } finally { document.documentElement.style.zoom = ""; }
});
