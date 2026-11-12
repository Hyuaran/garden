import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./hire-candidates.server", () => ({
  hireAdminContext: mocks.context,
  HireError: class extends Error { constructor(message: string, public status = 400) { super(message); } },
}));
import { deleteHireCandidate } from "./hire-candidate-delete.server";
beforeEach(() => {
  mocks.context.mockReset().mockResolvedValue({ db: { rpc: mocks.rpc }, userId: "actor" });
  mocks.rpc.mockReset().mockResolvedValue({ error: null });
});
const id = "11111111-1111-4111-8111-111111111111";
it("削除には閲覧用ではない全権管理者の認証を要求し、監査付きRPCへ操作者を渡す", async () => {
  await expect(deleteHireCandidate(id)).resolves.toEqual({ deleted: true });
  expect(mocks.context).toHaveBeenCalledWith();
  expect(mocks.rpc).toHaveBeenCalledWith("delete_unstarted_hire_candidate", { candidate_id: id, actor: "actor" });
});
it("全権管理者の認証に失敗したら削除を呼ばない", async () => {
  mocks.context.mockRejectedValue(new Error("閲覧権限がありません"));
  await expect(deleteHireCandidate(id)).rejects.toThrow("閲覧権限がありません");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("入社処理開始済みと権限不足をDBでも拒否する", async () => {
  mocks.rpc.mockResolvedValueOnce({ error: { code: "P0001", message: "入社処理が始まっているため削除できません" } });
  await expect(deleteHireCandidate(id)).rejects.toMatchObject({ status: 409 });
  mocks.rpc.mockResolvedValueOnce({ error: { code: "42501" } });
  await expect(deleteHireCandidate(id)).rejects.toMatchObject({ status: 403 });
});
