import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signOut: vi.fn().mockResolvedValue({}), counts: vi.fn().mockResolvedValue({ returned: 100, submitted: 1, finalPending: 2 }) }));
vi.mock("@/app/_lib/supabase/browser", () => ({ createBrowserClient: () => ({ auth: { signOut: mocks.signOut } }) }));
vi.mock("@/app/_lib/auth-unified", () => ({ useAuthUnified: () => ({ role: "staff" }) }));
vi.mock("@/app/_components/notices/NoticeBell", () => ({ NoticeBell: () => <span /> }));
vi.mock("@/app/_components/notices/NoticeProvider", () => ({ useNotices: () => ({ unreadCount: 2 }) }));
vi.mock("../_lib/mobile-expenses", () => ({ getMyEmployee: vi.fn().mockResolvedValue({ name: "確認 太郎" }), getMobileTodoCounts: mocks.counts }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(window.location.search), usePathname: () => "/m/todo" }));
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import Home from "../page";
import GardenHome from "@/app/_components/home/GardenHomeClient";
import { ThemeProvider } from "@/app/_lib/theme/ThemeProvider";
beforeEach(() => { window.localStorage.clear(); mocks.signOut.mockClear(); });
it("opens, closes on toggle, outside, Escape and keyboard focus leaving", async () => {
    render(<ThemeProvider><MobileHeader /></ThemeProvider>);
    const trigger = screen.getByRole("button", { name: "利用者メニュー" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("確認 太郎さん")).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    fireEvent.blur(trigger, { relatedTarget: document.body });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
});
it("uses shared theme selection and the shell sign-out", async () => {
    render(<ThemeProvider><MobileHeader /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "利用者メニュー" }));
    fireEvent.click(screen.getByRole("button", { name: "暗い表示" }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dark"));
    expect(screen.getByRole("button", { name: "暗い表示" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "明るい表示" }));
    await waitFor(() => expect(window.localStorage.getItem("garden.theme")).toBe("light"));
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
});
it("has only SVG navigation and badges, with accessible labels and unchanged counts", async () => {
    render(<MobileBottomNav />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
    for (const link of links) {
        expect(link.getAttribute("aria-label")).toBeTruthy();
        expect(link.querySelector("svg")).toBeTruthy();
        expect(within(link).queryByText(link.getAttribute("aria-label")!)).toBeNull();
    }
    expect(await screen.findByText("99+")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "やること" })).toHaveAttribute("aria-current", "page");
});
it("renders shared module artwork on both homes", () => {
    const mobile = render(<Home />);
    expect(mobile.container.querySelectorAll('svg[viewBox="0 0 56 56"]')).toHaveLength(12);
    expect(mobile.container.querySelector('img[src*="module-icons"]')).toBeNull();
    mobile.unmount();
    const desktop = render(<ThemeProvider><GardenHome /></ThemeProvider>);
    expect(desktop.container.querySelectorAll('svg[viewBox="0 0 56 56"]')).toHaveLength(13);
});
