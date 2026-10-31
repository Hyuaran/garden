import { expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),missing:vi.fn(()=>{throw new Error("404");})}));
vi.mock("./server",()=>({requireBoard:m.auth}));
vi.mock("next/navigation",()=>({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search),notFound:m.missing}));
vi.mock("./BoardClient",()=>({default:()=>null}));
import Page from "./page";
import { ViewPermissionError } from "@/lib/auth/view-permission.server";
it("権限のないURL直打ちは404",async()=>{m.auth.mockRejectedValue(new ViewPermissionError("閲覧権限がありません"));await expect(Page()).rejects.toThrow("404");});
