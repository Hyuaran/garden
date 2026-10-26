import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { canViewLeafForest, requireLeafForestRead } from "@/lib/auth/leaf-forest-view.server";
import { ViewPermissionError } from "@/lib/auth/view-permission.server";
import { LEAF_FOREST_TABS } from "@/lib/auth/leaf-forest-view-scopes";
import { leafPrototypeHtml } from "@/lib/auth/leaf-prototype-html";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode");
  if (mode !== "input" && mode !== "backoffice") return new Response("Not found", { status: 404 });
  const page = `leaf-kanden-${mode}`;
  const tab = request.nextUrl.searchParams.get("tab") ?? "input";
  try {
    if (mode === "input" && !LEAF_FOREST_TABS[page].some(([key]) => key === tab)) return new Response("Not found", { status: 404 });
    await requireLeafForestRead(page, mode === "input" ? tab : undefined);
    let html = await readFile(path.join(process.cwd(), "src/app/leaf/_templates", `${mode}.html`), "utf8");
    if (mode === "input") {
      const allowed = await Promise.all(LEAF_FOREST_TABS[page].map(([key]) => canViewLeafForest(page, key)));
      html = leafPrototypeHtml(html, tab, allowed.some(value => !value));
    }
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ViewPermissionError) return new Response(error.message, { status: error.status });
    throw error;
  }
}
