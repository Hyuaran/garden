import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChangeBirthdayModal } from "../ChangeBirthdayModal";

describe("ChangeBirthdayModal - 開閉", () => {
  it("open=false なら何も描画しない", () => {
    render(
      <ChangeBirthdayModal
        open={false}
        onClose={vi.fn()}
        currentBirthday="1990-05-07"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByText("誕生日の変更")).toBeNull();
  });

  it("open=true ならタイトル・閉じるボタンを描画する", () => {
    render(
      <ChangeBirthdayModal
        open
        onClose={vi.fn()}
        currentBirthday="1990-05-07"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText("誕生日の変更")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /キャンセル|閉じる|✕/ }),
    ).toBeInTheDocument();
  });

  it("キャンセルクリックで onClose が呼ばれる", async () => {
    const onClose = vi.fn();
    render(
      <ChangeBirthdayModal
        open
        onClose={onClose}
        currentBirthday="1990-05-07"
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).toHaveBeenCalled();
  });
});
