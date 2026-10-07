import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import tools from "../_data/gyomu-tools.json";

export type GyomuToolGroup = "auto" | "kintone";

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
