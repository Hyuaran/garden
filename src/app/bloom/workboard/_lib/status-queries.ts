import { supabase } from "../../_lib/supabase";
import type { WorkerStatus } from "../../_types/worker-status";

export async function fetchMyWorkerStatus(userId: string): Promise<WorkerStatus | null> {
  const { data, error } = await supabase
    .from("bloom_worker_status")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[bloom] fetchMyWorkerStatus failed:", error.message);
    return null;
  }
  return (data as WorkerStatus | null) ?? null;
}

/**
 * manager+ 向け: 全員のステータス読み取り。
 * §10.3 判4: manager は "忙しさ指標のみ" にしたいが、RLS で列絞り込みしにくいため
 * ここでは status / updated_at のみ SELECT する運用（見える列を絞って差を吸収）。
 */
export async function fetchTeamWorkerStatuses(
  options: { managerMode?: boolean } = {},
): Promise<Array<Pick<WorkerStatus, "user_id" | "status" | "updated_at">>> {
  const cols = options.managerMode
    ? "user_id, status, updated_at"
    : "user_id, status, status_note, until, updated_at, updated_by";
  const { data, error } = await supabase
    .from("bloom_worker_status")
    .select(cols)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[bloom] fetchTeamWorkerStatuses failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as Array<Pick<WorkerStatus, "user_id" | "status" | "updated_at">>;
}
