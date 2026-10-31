import "server-only";
import { SYSTEM_MANUALS, MANUAL_MODULES, manualDocPermissionKey } from "@/app/system/manuals/_lib/manuals-registry";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { canView, viewPermissionContext } from "./view-permission.server";

export async function visibleManuals(role: GardenRole) {
  const { viewer } = await viewPermissionContext();
  const available = [...new Map(SYSTEM_MANUALS.flatMap(manual => manual.docs).map(doc => [doc.key, doc])).values()];
  const access = await Promise.all(available.map(doc => canView("system-manuals", manualDocPermissionKey(doc.key), viewer, isRoleAtLeast(role, doc.minRole))));
  const allowed = new Set(available.filter((_, index) => access[index]).map(doc => doc.key));
  return SYSTEM_MANUALS.map(manual => {
    const docs = manual.docs.filter(doc => allowed.has(doc.key) && (doc.key !== "flow" || isRoleAtLeast(role, doc.minRole)));
    return { ...manual, docs, visibleDocs: docs };
  }).filter(manual => manual.docs.length);
}
export async function visibleManualModules(role: GardenRole) {
  const manuals = await visibleManuals(role);
  return MANUAL_MODULES.map(module => ({ ...module, count: manuals.filter(manual => manual.moduleSlug === module.slug).length })).filter(module => module.count);
}
