"use server";
import { broadbandAccess } from "@/lib/bud/broadband/access";
import { readIchiReport } from "@/lib/bud/ichi-report/read.server";
export async function refreshIchiReport() {
  const auth = await broadbandAccess();
  if (!auth.ok) throw new Error("権限がありません");
  return readIchiReport(true);
}
