import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import type { Notice } from "@/lib/notices";
const mocks = vi.hoisted(() => ({ path: "/system", role: "toss", state: null as unknown, ack: vi.fn(), snooze: vi.fn(), publish: vi.fn(), unpublish: vi.fn(), replace: vi.fn() }));
vi.mock("@/app/_lib/auth-unified", () => ({ useAuthUnified: () => ({ role: mocks.role, userId: "user", loading: false, isAuthenticated: true }) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search), usePathname: () => mocks.path, useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("./NoticeProvider", () => ({ useNotices: () => mocks.state }));
import NoticeModal from "./NoticeModal";
import { NoticeList } from "./NoticeList";
import { NoticeBell } from "./NoticeBell";
const rows: Notice[] = Array.from({ length: 7 }, (_, i) => ({ id: String(i), kind: "feature", title: `お知らせ${i}`, body: "説明", before_text: null, after_text: null, manual_href: null, module: i === 0 ? "Bud" : "System", visible_roles: [], status: "published", published_at: `2026-10-${String(19 - i).padStart(2, "0")}T03:00:00Z`, created_at: "2026-10-19T03:00:00Z" }));
beforeEach(() => { vi.clearAllMocks(); mocks.path = "/system"; mocks.role = "toss"; mocks.state = { snapshot: { employeeId: "e", hireDate: null, readIds: [], snoozedOn: null, notices: rows }, published: rows, unreadCount: 7, acknowledge: mocks.ack, snooze: mocks.snooze, publish: mocks.publish, unpublish: mocks.unpublish, error: false }; HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true; }); HTMLDialogElement.prototype.close = vi.fn(); });
afterEach(cleanup);
describe("お知らせ画面", () => {
    it("Systemへのリンク付きの現在地を表示する", () => {
        render(<NoticeList />);
        const breadcrumb = screen.getByRole("navigation", { name: "現在地" });
        expect(within(breadcrumb).getByRole("link", { name: "System" })).toHaveAttribute("href", "/system");
        expect(within(breadcrumb).getByText("お知らせ")).toBeInTheDocument();
    });
    it("最大5件を表示し、表示分だけ確認してすぐ閉じる", () => { render(<NoticeModal />); expect(screen.getByText("ほか 2 件はお知らせページで")).toBeInTheDocument(); expect(screen.queryByText("お知らせ5")).not.toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "確認しました" })); expect(mocks.ack).toHaveBeenCalledWith(["0", "1", "2", "3", "4"]); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); });
    it.each(["あとで", "閉じる"])("%s はあとでとしてすぐ閉じる", name => { render(<NoticeModal />); fireEvent.click(screen.getByRole("button", { name })); expect(mocks.snooze).toHaveBeenCalledOnce(); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); });
    it("Escと外側もあとでにする", () => { const r = render(<NoticeModal />); fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true })); expect(mocks.snooze).toHaveBeenCalledOnce(); r.unmount(); render(<NoticeModal />); fireEvent.click(screen.getByRole("dialog"), { clientX: -1, clientY: -1 }); expect(mocks.snooze).toHaveBeenCalledTimes(2); });
    it("除外画面には出さない", () => { mocks.path = "/p/customer"; render(<NoticeModal />); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); });
    it("ベルに未確認数と一覧へのリンクがある", () => { render(<NoticeBell />); expect(screen.getByRole("link", { name: "お知らせ（未確認 7 件）" })).toHaveAttribute("href", "/system/notices"); });
    it("一覧をモジュールで絞り込める", () => { render(<NoticeList />); fireEvent.click(screen.getByRole("button", { name: "モジュール" })); fireEvent.click(screen.getByRole("radio", { name: "Bud" })); fireEvent.click(screen.getByRole("button", { name: "OK" })); expect(screen.getByText("お知らせ0")).toBeInTheDocument(); expect(screen.queryByText("お知らせ1")).not.toBeInTheDocument(); expect(screen.queryByText(/下書き/)).not.toBeInTheDocument(); });
    it("全権管理者はタブで お知らせ／公開の管理 を分け、公開の管理では 公開する／公開しない／未決定 と色つきの札・状態の絞り込み（既定＝未決定）", async () => {
        mocks.role = "super_admin";
        const draft = { ...rows[0], id: "draft", status: "draft", published_at: null, title: "下書きの見出し" };
        const hidden = { ...rows[2], id: "hidden", status: "hidden", published_at: null, title: "出さないと決めた見出し" };
        (mocks.state as { snapshot: { notices: unknown[] } }).snapshot.notices = [rows[1], hidden, draft];
        render(<NoticeList />);
        // お知らせタブ＝読む人と同じ。ラジオは出ない・未確認だけ表示は既定でチェックあり
        expect(screen.getByLabelText(/未確認だけ表示/)).toBeChecked();
        expect(screen.queryAllByRole("radio")).toHaveLength(0);
        fireEvent.click(screen.getByRole("tab", { name: "公開の管理（未決定 1）" }));
        expect(screen.queryByLabelText(/未確認だけ表示/)).not.toBeInTheDocument();
        // 既定は 未決定 だけ
        expect(screen.getByRole("button", { name: "状態で絞り込む" })).toHaveTextContent("未決定 1");
        expect(screen.getByText("下書きの見出し")).toBeInTheDocument();
        expect(screen.queryByText("出さないと決めた見出し")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "状態で絞り込む" }));
        fireEvent.click(screen.getByRole("radio", { name: "すべて 3" }));
        fireEvent.click(screen.getByRole("button", { name: "OK" }));
        const pub = () => screen.getAllByRole("radio", { name: "公開する" });
        const hide = () => screen.getAllByRole("radio", { name: "公開しない" });
        const undecided = () => screen.getAllByRole("radio", { name: "未決定" });
        // 並び＝未決定 → 公開中 → 公開しない
        expect(undecided()[0]).toBeChecked(); expect(pub()[1]).toBeChecked(); expect(hide()[2]).toBeChecked();
        expect(screen.getAllByText("公開中").length).toBeGreaterThan(0);
        fireEvent.click(pub()[0]);
        expect(screen.getByRole("dialog", { name: "本当に公開しますか？" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "やめる" }));
        expect(mocks.publish).not.toHaveBeenCalled();
        fireEvent.click(pub()[0]);
        fireEvent.click(screen.getAllByRole("button", { name: "公開する" }).at(-1)!);
        expect(mocks.publish).toHaveBeenCalledWith("draft");
        fireEvent.click(hide()[1]); expect(mocks.unpublish).toHaveBeenLastCalledWith("1", "hidden");
        fireEvent.click(undecided()[2]); expect(mocks.unpublish).toHaveBeenLastCalledWith("hidden", "draft");
    });
});
