import { viewPermissionContext, ViewPermissionError } from "@/lib/auth/view-permission.server";
import { readSubmitters, writeSubmitter } from "./submitters.server";

const headers = { "Cache-Control": "private, no-store" };
export async function submittersRoute(request: Request) {
  try {
    const { viewer } = await viewPermissionContext();
    if (viewer.role !== "super_admin") {
      throw new ViewPermissionError("設定を変更する権限がありません。", 403);
    }
    if (request.method === "GET") {
      return Response.json(await readSubmitters(), { headers });
    }
    if (request.headers.get("sec-fetch-site") === "cross-site" ||
      (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)) {
      throw new ViewPermissionError("この画面から操作してください。", 403);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      throw new ViewPermissionError("設定内容を確認してください。", 400);
    }
    if (!body || typeof body.employee_id !== "string" || !body.employee_id || body.employee_id.length > 100 ||
      (request.method === "POST" && !["include", "exclude"].includes(body.mode))) {
      throw new ViewPermissionError("設定内容を確認してください。", 400);
    }
    const saved = await writeSubmitter(body.employee_id,
      request.method === "DELETE" ? null : body.mode, viewer.employeeId);
    if (!saved) throw new ViewPermissionError("在籍している人を選んでください。", 400);
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "提出する人の設定を処理できませんでした。" }, {
      status: error instanceof ViewPermissionError ? error.status : 500,
      headers,
    });
  }
}
