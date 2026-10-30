import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context:vi.fn(), search:vi.fn() }));
vi.mock("@/lib/search/search.server",()=>({gardenSearch:mocks.search}));
vi.mock("@/lib/auth/view-permission.server",()=>({viewPermissionContext:mocks.context, ViewPermissionError:class extends Error { constructor(message:string, public status=403){super(message);} }}));
import { ViewPermissionError } from "@/lib/auth/view-permission.server";
import { GET } from "./route";
beforeEach(()=>{vi.clearAllMocks();mocks.context.mockResolvedValue({});mocks.search.mockResolvedValue([]);});
it("requires login even for an empty search",async()=>{
  mocks.context.mockRejectedValue(new ViewPermissionError("login",401));
  expect((await GET(new Request("http://localhost/api/search?q="))).status).toBe(401);expect(mocks.search).not.toHaveBeenCalled();
});
it("validates length and passes only supported expansion values through the server cap",async()=>{
  expect((await GET(new Request(`http://localhost/api/search?q=${"a".repeat(201)}`))).status).toBe(400);
  await GET(new Request("http://localhost/api/search?q=1"));expect(mocks.search).not.toHaveBeenCalled();
  const response=await GET(new Request("http://localhost/api/search?q=1000&expanded=root_employees"));
  expect(mocks.search).toHaveBeenCalledWith("1000",new Set(["root_employees"]));expect(response.headers.get("Cache-Control")).toContain("no-store");
});
it("never echoes sensitive errors or the query",async()=>{
  mocks.search.mockRejectedValue(new Error("private account data"));
  const response=await GET(new Request("http://localhost/api/search?q=private"));
  expect(response.status).toBe(503);expect(await response.text()).not.toContain("private");
});
