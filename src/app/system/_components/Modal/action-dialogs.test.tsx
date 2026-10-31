import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ConfirmedDangerAction from "./ConfirmedDangerAction";
import { useActionDialog } from "./useActionDialog";

afterEach(cleanup);

it("危ない操作は確認を取り消せ、実行中の二重送信を防ぐ", async () => {
  let finish!: () => void;
  const action = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  render(<ConfirmedDangerAction label="削除" onConfirm={action} />);
  fireEvent.click(screen.getByRole("button", { name: "削除" }));
  fireEvent.click(screen.getByRole("button", { name: "やめる" }));
  expect(action).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "削除" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "削除" }));
  expect(action).toHaveBeenCalledTimes(1);
  expect(within(dialog).getByRole("button", { name: "処理中..." })).toBeDisabled();
  finish();
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("理由入力と確認を共通の小窓で順に行い、取り消し時は実行しない", async () => {
  const action = vi.fn();
  function Example() {
    const dialog = useActionDialog();
    async function remove() {
      const reason = await dialog.prompt("削除理由を入力してください", "対象外");
      if (reason && await dialog.confirm(`${reason}として削除しますか？`)) action(reason);
    }
    return <>{dialog.dialog}<button onClick={() => void remove()}>削除を始める</button></>;
  }
  render(<Example />);
  fireEvent.click(screen.getByRole("button", { name: "削除を始める" }));
  expect(screen.getByLabelText("理由")).toHaveValue("対象外");
  fireEvent.change(screen.getByLabelText("理由"), { target: { value: "重複" } });
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
  expect(within(await screen.findByRole("dialog", { name: "確認" })).getByText("重複として削除しますか？")).toBeInTheDocument();
  expect(action).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "やめる" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(action).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "削除を始める" }));
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
  expect(within(await screen.findByRole("dialog", { name: "確認" })).getByText("対象外として削除しますか？")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "実行する" }));
  await waitFor(() => expect(action).toHaveBeenCalledWith("対象外"));
});
