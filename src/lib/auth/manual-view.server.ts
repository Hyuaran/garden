import "server-only";
import { MANUAL_DOCS, SYSTEM_MANUALS, MANUAL_MODULES } from "@/app/system/manuals/_lib/manuals-registry";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { canView, viewPermissionContext } from "./view-permission.server";

export async function visibleManuals(role: GardenRole) {
  const { viewer } = await viewPermissionContext();
  const access = await Promise.all(MANUAL_DOCS.map(doc => canView("system-manuals", doc.key, viewer, isRoleAtLeast(role, doc.minRole))));
  const docs = MANUAL_DOCS.filter((_, index) => access[index]);
  return SYSTEM_MANUALS.map(manual => ({ ...manual, docs, visibleDocs: docs })).filter(manual => manual.docs.length);
}
export async function visibleManualModules(role: GardenRole) {
  const manuals = await visibleManuals(role);
  return MANUAL_MODULES.map(module => ({ ...module, count: manuals.filter(manual => manual.moduleSlug === module.slug).length })).filter(module => module.count);
}
