import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import Modal from "./Modal";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

it("見出しを関連付け、最初の入力欄へ移動し、閉じると元のボタンに戻す", () => {
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const { unmount } = render(<Modal title="確認" onClose={vi.fn()} size="sm"><label>氏名<input /></label></Modal>);
  expect(screen.getByRole("dialog", { name: "確認" })).toHaveAttribute("data-size", "sm");
  expect(screen.getByRole("textbox")).toHaveFocus();
  expect(document.body.style.overflow).toBe("hidden");
  unmount();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe("");
  trigger.remove();
});

it("Esc と枠の外で閉じ、本文を押しても閉じない", () => {
  const onClose = vi.fn();
  render(<Modal title="確認" onClose={onClose}><p>本文</p></Modal>);
  const dialog = screen.getByRole("dialog");
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({ left: 100, right: 500, top: 100, bottom: 400 } as DOMRect);
  fireEvent.click(screen.getByText("本文"));
  fireEvent.click(dialog, { clientX: 200, clientY: 200 });
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(dialog, { clientX: 50, clientY: 50 });
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(2);
});

it("小窓を重ねても最後の小窓を閉じるまで背景のスクロールを止める", () => {
  const parent = render(<Modal title="親" onClose={vi.fn()}><input /></Modal>);
  const child = render(<Modal title="子" onClose={vi.fn()}><input /></Modal>);
  child.unmount();
  expect(document.body.style.overflow).toBe("hidden");
  parent.unmount();
  expect(document.body.style.overflow).toBe("");
});

it("確認必須の小窓は閉じる操作を受け付けない", () => {
  const onClose = vi.fn();
  render(<Modal title="必須の確認" dismissible={false} onClose={onClose}>内容</Modal>);
  const dialog = screen.getByRole("dialog");
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  fireEvent.click(dialog, { clientX: -10, clientY: -10 });
  expect(screen.queryByRole("button", { name: "閉じる" })).toBeNull();
  expect(onClose).not.toHaveBeenCalled();
});

it("lg の幅指定をパネルに付ける", () => {
 render(<Modal title="大きい小窓" size="lg" onClose={vi.fn()}>本文</Modal>);
 expect(screen.getByRole("dialog", { name: "大きい小窓" })).toHaveAttribute("data-size", "lg");
});
