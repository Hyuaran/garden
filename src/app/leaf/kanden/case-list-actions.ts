"use server";

import { requireSystemView } from "@/lib/auth/view-permission.server";
import type { TableQuery } from "@/app/system/_components/DataTable/DataTable";
import { CASE_TABS, type KandenTab } from "./cases";
import { readCaseList } from "./case-queries.server";

export async function loadCaseList(year: number, tab: KandenTab, query: TableQuery, counts = false) {
  try {
    await requireSystemView("leaf-kanden");
    if (!Number.isInteger(year) || year < 1000 || year > 9999 ||
        (tab !== "forms" && !CASE_TABS.some(item => item.key === tab))) return null;
    return await readCaseList(year, tab, query, counts === true);
  } catch {
    return null;
  }
}
