import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
// Vitest は Next のサーバー境界を実行しない。サーバーモジュールの振る舞いは個別に検証する。
vi.mock("server-only", () => ({}));

// jsdom にない native dialog API。実際のフォーカス制御は Modal のテストで確認する。
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
}
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function () { this.open = false; };
}

// テスト専用のダミー値。本番の認証情報は使わない。
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
