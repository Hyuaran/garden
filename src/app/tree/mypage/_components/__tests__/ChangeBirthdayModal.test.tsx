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

describe("ChangeBirthdayModal - フォーム", () => {
  it("新誕生日と現パスワードが空の状態では『変更する』が disabled", () => {
    render(
      <ChangeBirthdayModal
        open
        onClose={vi.fn()}
        currentBirthday="1990-05-07"
        onSubmit={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "変更する" }),
    ).toBeDisabled();
  });

  it("両方入力すると『変更する』が活性化", () => {
    render(
      <ChangeBirthdayModal
        open
        onClose={vi.fn()}
        currentBirthday="1990-05-07"
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.change(
      screen.getByLabelText("新しい誕生日"),
      { target: { value: "1985-12-03" } },
    );
    fireEvent.change(
      screen.getByLabelText("現在のパスワード"),
      { target: { value: "0507" } },
    );
    expect(
      screen.getByRole("button", { name: "変更する" }),
    ).toBeEnabled();
  });
});

describe("ChangeBirthdayModal - submit 成功", () => {
  it("成功時に onSubmit が正しい引数で呼ばれ、onSuccess + onClose が呼ばれる", async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValue({ success: true });
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(
      <ChangeBirthdayModal
        open
        onClose={onClose}
        currentBirthday="1990-05-07"
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.change(screen.getByLabelText("新しい誕生日"), {
      target: { value: "1985-12-03" },
    });
    fireEvent.change(screen.getByLabelText("現在のパスワード"), {
      target: { value: "0507" },
    });
    fireEvent.click(screen.getByRole("button", { name: "変更する" }));

    // 非同期 submit 完了を await
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        newBirthday: "1985-12-03",
        currentPassword: "0507",
      });
    });
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("送信中は『変更中...』表示で disabled", async () => {
    const onSubmit = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true }), 50),
          ),
      );
    render(
      <ChangeBirthdayModal
        open
        onClose={vi.fn()}
        currentBirthday="1990-05-07"
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByLabelText("新しい誕生日"), {
      target: { value: "1985-12-03" },
    });
    fireEvent.change(screen.getByLabelText("現在のパスワード"), {
      target: { value: "0507" },
    });
    fireEvent.click(screen.getByRole("button", { name: "変更する" }));

    // 即座に「変更中...」が現れることを確認
    expect(
      await screen.findByRole("button", { name: "変更中..." }),
    ).toBeDisabled();
  });
});
