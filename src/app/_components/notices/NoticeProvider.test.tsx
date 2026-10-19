import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), ack: vi.fn(), snooze: vi.fn(), path: "/system" }));
vi.mock("@/app/_lib/auth-unified", () => ({ useAuthUnified: () => ({ userId: "u", role: "toss", loading: false }) }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path }));
vi.mock("@/app/_lib/supabase/browser", () => ({ createBrowserClient: () => ({}) }));
vi.mock("@/lib/notices", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/notices")>(), fetchNotices: mocks.fetch, acknowledgeNotices: mocks.ack, snoozeNotices: mocks.snooze }));
import { NoticeProvider, useNotices } from "./NoticeProvider";
function Consumer() { const state = useNotices(); return <><span>件数 {state?.unreadCount}</span><span>あとで {state?.snapshot?.snoozedOn}</span><button onClick={() => state?.acknowledge(["a"])}>確認</button><button onClick={() => state?.snooze()}>あとで</button></>; }
beforeEach(() => { vi.clearAllMocks(); mocks.path = "/system"; mocks.fetch.mockResolvedValue({ employeeId: "e", hireDate: null, readIds: [], snoozedOn: null, notices: [{ id: "a", status: "published", visible_roles: [], published_at: "2026-10-19T03:00:00Z" }] }); mocks.ack.mockRejectedValue(new Error("offline")); mocks.snooze.mockRejectedValue(new Error("offline")); });
afterEach(cleanup);
describe("NoticeProvider", () => {
    it("描画後に取得し、保存が失敗しても既読数を直ちに更新する", async () => { render(<NoticeProvider><Consumer /></NoticeProvider>); expect(mocks.fetch).not.toHaveBeenCalled(); await screen.findByText("件数 1"); fireEvent.click(screen.getByText("確認")); expect(screen.getByText("件数 0")).toBeInTheDocument(); await waitFor(() => expect(mocks.ack).toHaveBeenCalledWith({}, "e", ["a"])); });
    it("あとでの保存が失敗しても当日の抑制を維持する", async () => { render(<NoticeProvider><Consumer /></NoticeProvider>); await screen.findByText("件数 1"); fireEvent.click(screen.getByRole("button", { name: "あとで" })); expect(screen.getByText(/^あとで \d{4}-\d{2}-\d{2}$/)).toBeInTheDocument(); await waitFor(() => expect(mocks.snooze).toHaveBeenCalledOnce()); });
    it("除外画面では取得しない", async () => { mocks.path = "/p/customer"; render(<NoticeProvider><Consumer /></NoticeProvider>); await new Promise(resolve => setTimeout(resolve, 10)); expect(mocks.fetch).not.toHaveBeenCalled(); });
});
