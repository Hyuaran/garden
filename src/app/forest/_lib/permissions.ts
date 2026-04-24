/**
 * Forest 権限判定ヘルパー
 */
import type { ForestUser } from "../_constants/companies";

export function isForestAdmin(user: ForestUser | null): boolean {
  return user?.role === "admin";
}
