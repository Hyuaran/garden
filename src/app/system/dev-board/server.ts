import "server-only";
import { requireSystemView } from "@/lib/auth/view-permission.server";
export async function requireBoard() { return requireSystemView("system-dev-board"); }
