import "server-only";
import { HireError, hireAdminContext } from "./hire-candidates.server";

export async function deleteHireCandidate(id: string) {
  // 閲覧権限とは分け、全権管理者の認証を必ず通す。
  const { db, userId } = await hireAdminContext();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new HireError("入社予定者を確認してください");
  const { error } = await db.rpc("delete_unstarted_hire_candidate", { candidate_id: id, actor: userId });
  if (error) {
    if (error.code === "42501") throw new HireError("全権管理者だけが削除できます", 403);
    if (error.code === "P0001") throw new HireError(error.message, 409);
    throw new HireError("削除できませんでした。時間をおいてお試しください", 503);
  }
  return { deleted: true };
}
