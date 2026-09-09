import type { GardenRole } from "@/app/root/_constants/types";

/**
 * 「責任者以上だけが見られる」画面・API が共通で使う役職の集合。
 * page.tsx／layout.tsx／route.ts から直接 export すると Next のビルド検査
 * （許可されていない export）で落ちるため、ここに置いて各入口と権限一覧の両方から参照する。
 * 使っている入口: system/call-metrics/page.tsx・system/contracts/layout.tsx・
 *               api/system/call-metrics/route.ts・api/system/call-report/route.ts
 */
export const MANAGER_VIEW_ROLES: ReadonlySet<GardenRole> = new Set<GardenRole>(["manager", "admin", "super_admin"]);
