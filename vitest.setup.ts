import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
// Vitest は Next のサーバー境界を実行しない。サーバーモジュールの振る舞いは個別に検証する。
vi.mock("server-only", () => ({}));
