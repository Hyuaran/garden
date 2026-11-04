import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { systemViewResponse } from "@/lib/auth/view-permission.server";
import { parseJstDate } from "@/app/system/_lib/attendance";
import {
  punchSendRows,
  pushPunchDay,
} from "@/lib/attendance/kot-punch-push.server";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
async function authorize() {
  const denied = await systemViewResponse("system-kanri", "kanri", true);
  if (denied) return denied;
  return (
    (await requireManager()) ||
    Response.json({ error: "閲覧権限がありません" }, { status: 403 })
  );
}
export async function GET(request: Request) {
  const actor = await authorize();
  if (actor instanceof Response) return actor;
  try {
    const date = parseJstDate(
      new URL(request.url).searchParams.get("date"),
    ).date;
    return Response.json(await punchSendRows(date), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "送信対象を読み込めませんでした。" },
      { status: 400 },
    );
  }
}
export async function POST(request: Request) {
  const actor = await authorize();
  if (actor instanceof Response) return actor;
  try {
    const body = await request.json();
    if (typeof body.date !== "string")
      throw new Error("日付を入力してください。");
    const date = parseJstDate(body.date).date;
    if (typeof body.employee_id !== "string")
      throw new Error("対象者を確認してください。");
    return Response.json(
      await pushPunchDay(
        date,
        body.employee_id,
        actor.employee_id,
        body.manual === true,
      ),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "送信できませんでした。",
      },
      { status: 400 },
    );
  }
}
