import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import tools from "../_data/gyomu-tools.json";

// auto＝Garden（Vercel）で自動／host＝社内ホスト PC の常駐（東海林さん 2026-10-19「ホスト PC は独立した項目に」）／kintone＝Kintone に入れたしかけ
export type GyomuToolGroup = "auto" | "host" | "kintone";

export type GyomuTool = {
  group: GyomuToolGroup;
  name: string;
  description: string;
  schedule?: string;
  runsOn?: string;
  target?: string;
  href?: string;
  url?: string;
  since?: string;
  details?: string[];
  minRole?: "staff" | "manager" | "super_admin";
};

export const GYOMU_TOOLS = tools as GyomuTool[];

export function getVisibleGyomuTools(role: GardenRole) {
  return GYOMU_TOOLS.filter((tool) => isRoleAtLeast(role, tool.minRole ?? "staff"));
}
