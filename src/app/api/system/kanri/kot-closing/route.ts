import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { systemViewResponse } from "@/lib/auth/view-permission.server";
import { parseJstDate } from "@/app/system/_lib/attendance";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checked, punchRelay } from "@/lib/attendance/kot-punch-push.server";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  const denied = await systemViewResponse("system-kanri", "kanri", true);
  if (denied) return denied;
  const actor = await requireManager();
  if (!actor)
    return Response.json({ error: "閲覧権限がありません" }, { status: 403 });
  try {
    const date = parseJstDate(
      new URL(request.url).searchParams.get("date"),
    ).date;
    const employees = (await punchRelay(
      { method: "GET", path: "/employees?includeResigner=true" },
      actor.employee_id,
      false,
    )) as { key: string; code: string }[];
    const result = (await punchRelay(
      { method: "GET", path: "/daily-workings/" + date },
      actor.employee_id,
      false,
    )) as {
      date: string;
      dailyWorkings?: { employeeKey: string; isClosing?: boolean }[];
    }[];
    if (!Array.isArray(result) || !Array.isArray(employees))
      throw new Error("KING OF TIME の締めを確認できませんでした。");
    const people =
      checked(
        await getSupabaseAdmin()
          .from("root_employees")
          .select("employee_id,kot_employee_id,name"),
      ) || [];
    const rows = result
      .flatMap((day) => day.dailyWorkings || [])
      .map((row) => {
        const code = employees.find(
          (person) => person.key === row.employeeKey,
        )?.code;
        const person = people.find((person) => person.kot_employee_id === code);
        return {
          employeeKey: row.employeeKey,
          name: person?.name || "氏名を確認できません",
          isClosing: row.isClosing === true,
        };
      });
    if (!rows.length) throw new Error("対象日の勤怠がありません。");
    return Response.json(
      { date, rows, confirmed: rows.every((row) => row.isClosing) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "締めを確かめられませんでした。",
      },
      { status: 400 },
    );
  }
}
