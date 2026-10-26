import { bloomRead } from '../../_lib/view-read';
import type { ModuleProgress } from "../../_types/module-progress";

/** Garden 9 モジュールの進捗スナップショットを display_order 順に取得 */
export async function fetchModuleProgress(): Promise<ModuleProgress[]> {
return bloomRead('modules');
}
