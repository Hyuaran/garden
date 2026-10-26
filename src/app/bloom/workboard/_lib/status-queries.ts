import { bloomRead } from '../../_lib/view-read';
import type { WorkerStatus } from "../../_types/worker-status";

export async function fetchMyWorkerStatus(userId: string): Promise<WorkerStatus | null> {
return bloomRead('myStatus');
}

/**
 * manager+ 向け: 全員のステータス読み取り。
 * §10.3 判4: manager は "忙しさ指標のみ" にしたいが、RLS で列絞り込みしにくいため
 * ここでは status / updated_at のみ SELECT する運用（見える列を絞って差を吸収）。
 */
export async function fetchTeamWorkerStatuses(
  options: { managerMode?: boolean } = {},
): Promise<Array<Pick<WorkerStatus, "user_id" | "status" | "updated_at">>> {
return bloomRead('teamStatus', {managerMode: options.managerMode});
}
