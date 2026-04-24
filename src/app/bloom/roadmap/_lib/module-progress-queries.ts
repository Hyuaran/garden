import { supabase } from "../../_lib/supabase";
import type { ModuleProgress } from "../../_types/module-progress";

/** Garden 9 モジュールの進捗スナップショットを display_order 順に取得 */
export async function fetchModuleProgress(): Promise<ModuleProgress[]> {
  const { data, error } = await supabase
    .from("bloom_module_progress")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) {
    console.error("[bloom] fetchModuleProgress failed:", error.message);
    return [];
  }
  return (data ?? []) as ModuleProgress[];
}
