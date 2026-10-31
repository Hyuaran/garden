import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RowActionButton from "./RowActionButton";

describe("RowActionButton", () => {
  it("編集の名前と title を持ち、鉛筆の先は左下から始まる", () => {
    render(<RowActionButton kind="edit" />);
    const button = screen.getByRole("button", { name: "編集" });
    expect(button).toHaveAttribute("title", "編集");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveTextContent("");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(button.querySelector("path")).toHaveAttribute("d", "M4 20l1-5L16 4l4 4L9 19l-5 1z");
  });
  it("削除の名前と title を持ち、クリックを呼び出し元へ渡す", () => {
    const click = vi.fn();
    render(<RowActionButton kind="delete" onClick={click} />);
    const button = screen.getByRole("button", { name: "削除" });
    expect(button).toHaveAttribute("title", "削除");
    fireEvent.click(button);
    expect(click).toHaveBeenCalledOnce();
  });
  it("対象名を付けられ、disabled では操作できない", () => {
    const click = vi.fn();
    render(<RowActionButton kind="edit" label="代表番号を編集" disabled onClick={click} />);
    const button = screen.getByRole("button", { name: "代表番号を編集" });
    expect(button).toHaveAttribute("title", "代表番号を編集");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(click).not.toHaveBeenCalled();
  });
});
