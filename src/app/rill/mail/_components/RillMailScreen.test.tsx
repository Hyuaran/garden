import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RillMailScreen } from "./RillMailScreen";
import type { RillMailDetail, RillMailMessage } from "../_lib/types";

const personalBox = { id: "me", address: "me@example.com", label: "東海林 美琴", kind: "personal" as const };
const sharedBox = { id: "shared", address: "keiri@example.com", label: "keiri", kind: "shared" as const };

const messages: RillMailMessage[] = [
  {
    id: "m1",
    box: personalBox,
    subject: "取次進捗報告【株式会社ARATA】",
    fromName: "kanri@example.com",
    fromAddress: "kanri@example.com",
    to: ["me@example.com"],
    receivedDateTime: "2026-09-18T10:00:00.000Z",
    hasAttachments: false,
    isRead: true,
    categories: [],
    bodyPreview: "株式会社ARATA ご担当者様、進捗をご報告します。",
  },
  {
    id: "m2",
    box: sharedBox,
    subject: "共有の確認",
    fromName: "keiri@example.com",
    fromAddress: "keiri@example.com",
    to: ["keiri@example.com"],
    receivedDateTime: "2026-09-18T11:00:00.000Z",
    hasAttachments: false,
    isRead: true,
    categories: [],
    bodyPreview: "共有箱のメールです。",
  },
];

const detail: RillMailDetail = {
  ...messages[0],
  cc: [],
  bcc: [],
  body: { contentType: "text", content: "本文です。" },
  attachments: [],
};

const jsonResponse = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { "Content-Type": "application/json" },
  ...init,
});

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue("1");
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/rill/mail/boxes") return jsonResponse({ boxes: [personalBox, sharedBox], reviewers: ["東海林美琴"], ownName: null, userId: "user-1" });
    if (url.startsWith("/api/rill/mail/messages?")) return jsonResponse({ messages, cursor: null });
    if (url.startsWith("/api/rill/mail/messages/m1?")) return jsonResponse(detail);
    if (url.startsWith("/api/rill/mail/messages/m2?")) return jsonResponse({ ...detail, ...messages[1], body: { contentType: "text", content: "共有本文です。" } });
    if (url.startsWith("/api/rill/mail/intake?")) return jsonResponse({ items: [] });
    if (url === "/api/rill/mail/translate") return jsonResponse({ available: false });
    if (url === "/api/rill/mail/notifications/status") return jsonResponse({ lastNotifiedAt: null });
    if (url === "/api/rill/mail/anomalies") return jsonResponse({ anomalies: [], counts: { "要対応": 0, "確認中": 0, "状態なし": 0 } });
    return jsonResponse({});
  }) as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RillMailScreen", () => {
  it("1024px 以下では最初に一覧だけを表示し、メール選択と戻るで切り替える", async () => {
    mockMatchMedia(true);
    render(<RillMailScreen />);

    const list = await screen.findByLabelText("メール一覧");
    const boxes = screen.getByLabelText("箱の一覧");
    const reader = screen.getByLabelText("メール本文");
    expect(list).not.toHaveAttribute("hidden");
    expect(boxes).toHaveAttribute("hidden");
    expect(reader).toHaveAttribute("hidden");

    fireEvent.click(within(list).getByRole("button", { name: /取次進捗報告/ }));
    await waitFor(() => expect(reader).not.toHaveAttribute("hidden"));
    expect(list).toHaveAttribute("hidden");
    expect(boxes).toHaveAttribute("hidden");

    fireEvent.click(within(reader).getByRole("button", { name: "一覧へ" }));
    await waitFor(() => expect(list).not.toHaveAttribute("hidden"));
    expect(reader).toHaveAttribute("hidden");
  });

  it("1024px 以下では箱ボタンから箱の一覧へ移り、選ぶと一覧へ戻って絞り込む", async () => {
    mockMatchMedia(true);
    render(<RillMailScreen />);

    const list = await screen.findByLabelText("メール一覧");
    fireEvent.click(within(list).getByRole("button", { name: /すべての箱/ }));

    const boxes = screen.getByLabelText("箱の一覧");
    expect(boxes).not.toHaveAttribute("hidden");
    expect(list).toHaveAttribute("hidden");

    fireEvent.click(within(boxes).getByRole("button", { name: "keiri" }));
    await waitFor(() => expect(list).not.toHaveAttribute("hidden"));
    expect(within(list).getByText("共有の確認")).toBeInTheDocument();
    expect(within(list).queryByText("取次進捗報告【株式会社ARATA】")).not.toBeInTheDocument();
  });

  it("761px 以上では3列をすべて表示する", async () => {
    mockMatchMedia(false);
    render(<RillMailScreen />);

    await screen.findByLabelText("メール一覧");
    expect(screen.getByLabelText("箱の一覧")).not.toHaveAttribute("hidden");
    expect(screen.getByLabelText("メール一覧")).not.toHaveAttribute("hidden");
    expect(screen.getByLabelText("メール本文")).not.toHaveAttribute("hidden");
  });
});
