import { createServerClient } from "@/app/_lib/supabase/server";
import { buildMyPageProfile } from "@/app/system/mypage/_lib/mypage-profile.server";

type Body = { code?: unknown };

export async function POST(request: Request) {
  let body: Body;
  try { body = await request.json() as Body; }
  catch { return Response.json({ ok: false }, { status: 400 }); }
  if (typeof body.code !== "string" || !/^\d{4}$/.test(body.code)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ ok: false }, { status: 401 });

  const { data: employee, error } = await supabase.from("root_employees")
    .select("employee_id,name,name_kana,employee_number,employment_type,birthday,email,garden_role,commute_daily_allowance,commute_monthly_cap")
    .eq("user_id", auth.user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  if (error) return Response.json({ ok: false }, { status: 500 });
  if (!employee) return Response.json({ ok: false }, { status: 409 });

  const birthday = typeof employee.birthday === "string" ? employee.birthday : null;
  if (!birthday) return Response.json({ ok: true, profile: await buildMyPageProfile(employee) });
  const match = /^(?:\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!match || body.code !== `${match[1]}${match[2]}`) return Response.json({ ok: false });
  return Response.json({ ok: true, profile: await buildMyPageProfile(employee) });
}
