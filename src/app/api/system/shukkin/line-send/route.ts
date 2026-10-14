import { NextResponse } from "next/server";
import { requireStaff } from "@/app/system/mypage/_lib/submission-server";
import { getLineStaffQuota, pushLineStaff } from "@/lib/line/staff-client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendBlock = {
  shift: string;
  employeeNumbers: string[];
  message: string;
};

type EmployeeLineRow = {
  employee_id?: string | null;
  employee_number?: string | null;
  name?: string | null;
  line_user_id?: string | null;
  line_link_source?: string | null;
};

function normalizeEmployeeNumber(value: unknown) {
  return String(value ?? "").trim().padStart(4, "0");
}

function normalizeBlocks(value: unknown): SendBlock[] | null {
  if (!Array.isArray(value)) return null;
  const blocks = value.map((item) => {
    const row = item as { shift?: unknown; employeeNumbers?: unknown; message?: unknown };
    const shift = typeof row.shift === "string" ? row.shift.trim() : "";
    const message = typeof row.message === "string" ? row.message : "";
    const employeeNumbers = Array.isArray(row.employeeNumbers)
      ? row.employeeNumbers.map(normalizeEmployeeNumber).filter((number) => /^\d{4}$/.test(number))
      : [];
    if (!shift || !message.trim()) return null;
    return { shift, employeeNumbers: [...new Set(employeeNumbers)], message };
  });
  return blocks.every(Boolean) ? blocks as SendBlock[] : null;
}

function nowIso() {
  return new Date().toISOString();
}

async function loadEmployees(employeeNumbers: string[]) {
  const numbers = [...new Set(employeeNumbers)];
  if (numbers.length === 0) return new Map<string, EmployeeLineRow>();
  const { data, error } = await getSupabaseAdmin()
    .from("root_employees")
    .select("employee_id,employee_number,name,line_user_id,line_link_source")
    .in("employee_number", numbers)
    .eq("is_active", true)
    .is("deleted_at", null);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [String(row.employee_number ?? ""), row as EmployeeLineRow]));
}

async function ownLineUserId(employeeId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("root_employees")
    .select("line_user_id,line_link_source")
    .eq("employee_id", employeeId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle<{ line_user_id?: string | null; line_link_source?: string | null }>();
  if (error) throw error;
  return data?.line_link_source === "unfollowed" ? null : data?.line_user_id ?? null;
}

export async function GET(request: Request) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const neededParam = params.get("needed");
  const needed = Math.max(0, Number(neededParam ?? "0") || 0);
  const employeeNumbers = [...new Set(params.getAll("employeeNumber").map(normalizeEmployeeNumber).filter((number) => /^\d{4}$/.test(number)))];
  const members = employeeNumbers.length > 0 ? [...(await loadEmployees(employeeNumbers)).values()].map((employee) => ({
    employeeNumber: String(employee.employee_number ?? ""),
    name: String(employee.name ?? ""),
    linked: Boolean(employee.line_user_id && employee.line_link_source !== "unfollowed"),
    blocked: employee.line_link_source === "unfollowed",
  })) : [];
  const ownLinked = Boolean(await ownLineUserId(String(staff.employee_id)).catch(() => null));
  try {
    const quota = await getLineStaffQuota();
    return NextResponse.json({
      ok: true,
      quota: quota.quota,
      used: quota.used,
      remaining: quota.remaining,
      needed,
      members,
      ownLinked,
    });
  } catch {
    return NextResponse.json({ ok: true, quota: null, used: 0, remaining: null, needed, members, ownLinked });
  }
}

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as { date?: unknown; blocks?: unknown; testOnly?: unknown } | null;
  const workDate = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : "";
  const blocks = normalizeBlocks(body?.blocks);
  const testOnly = body?.testOnly === true;
  if (!workDate || !blocks || blocks.length === 0) return NextResponse.json({ ok: false, error: "送る内容を確認してください" }, { status: 400 });

  const client = getSupabaseAdmin();
  const sentAt = nowIso();
  const sent: Array<{ employeeNumber: string; name: string; shift: string }> = [];
  const unlinked: Array<{ employeeNumber: string; name: string; shift: string; reason: "unlinked" | "blocked" }> = [];
  const failed: Array<{ employeeNumber: string; name: string; shift: string; error: string }> = [];

  if (testOnly) {
    const lineUserId = await ownLineUserId(String(staff.employee_id));
    if (!lineUserId) return NextResponse.json({ ok: false, error: "自分の LINE を先に連携してください" }, { status: 400 });
    for (const block of blocks) {
      try {
        await pushLineStaff([lineUserId], block.message);
        sent.push({ employeeNumber: String(staff.employee_number ?? ""), name: String(staff.name ?? ""), shift: "試し送り" });
        await client.from("system_line_staff_message").insert({
          work_date: workDate,
          shift: "試し送り",
          employee_id: String(staff.employee_id),
          employee_number: String(staff.employee_number ?? ""),
          line_user_id: lineUserId,
          message: block.message,
          status: "sent",
          sent_by_employee_id: String(staff.employee_id),
          sent_at: sentAt,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ employeeNumber: String(staff.employee_number ?? ""), name: String(staff.name ?? ""), shift: "試し送り", error: message });
        await client.from("system_line_staff_message").insert({
          work_date: workDate,
          shift: "試し送り",
          employee_id: String(staff.employee_id),
          employee_number: String(staff.employee_number ?? ""),
          line_user_id: lineUserId,
          message: block.message,
          status: "failed",
          error: message,
          sent_by_employee_id: String(staff.employee_id),
          sent_at: sentAt,
        });
      }
    }
    return NextResponse.json({ ok: failed.length === 0, sent, unlinked, failed, sentAt });
  }

  const employeeMap = await loadEmployees(blocks.flatMap((block) => block.employeeNumbers));
  for (const block of blocks) {
    const deliverable: EmployeeLineRow[] = [];
    const blockUnlinked: EmployeeLineRow[] = [];
    for (const employeeNumber of block.employeeNumbers) {
      const employee = employeeMap.get(employeeNumber) ?? { employee_number: employeeNumber, name: "" };
      if (!employee.line_user_id || employee.line_link_source === "unfollowed") blockUnlinked.push(employee);
      else deliverable.push(employee);
    }

    for (const employee of blockUnlinked) {
      const reason = employee.line_link_source === "unfollowed" ? "blocked" : "unlinked";
      unlinked.push({ employeeNumber: String(employee.employee_number ?? ""), name: String(employee.name ?? ""), shift: block.shift, reason });
      await client.from("system_line_staff_message").insert({
        work_date: workDate,
        shift: block.shift,
        employee_id: employee.employee_id ?? null,
        employee_number: String(employee.employee_number ?? ""),
        line_user_id: employee.line_user_id ?? null,
        message: block.message,
        status: "unlinked",
        error: reason === "blocked" ? "ブロック中" : "未紐づけ",
        sent_by_employee_id: String(staff.employee_id),
        sent_at: sentAt,
      });
    }

    if (deliverable.length === 0) continue;
    try {
      await pushLineStaff(deliverable.map((employee) => String(employee.line_user_id)), block.message);
      for (const employee of deliverable) {
        sent.push({ employeeNumber: String(employee.employee_number ?? ""), name: String(employee.name ?? ""), shift: block.shift });
        await client.from("system_line_staff_message").insert({
          work_date: workDate,
          shift: block.shift,
          employee_id: employee.employee_id ?? null,
          employee_number: String(employee.employee_number ?? ""),
          line_user_id: employee.line_user_id,
          message: block.message,
          status: "sent",
          sent_by_employee_id: String(staff.employee_id),
          sent_at: sentAt,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const employee of deliverable) {
        failed.push({ employeeNumber: String(employee.employee_number ?? ""), name: String(employee.name ?? ""), shift: block.shift, error: message });
        await client.from("system_line_staff_message").insert({
          work_date: workDate,
          shift: block.shift,
          employee_id: employee.employee_id ?? null,
          employee_number: String(employee.employee_number ?? ""),
          line_user_id: employee.line_user_id,
          message: block.message,
          status: "failed",
          error: message,
          sent_by_employee_id: String(staff.employee_id),
          sent_at: sentAt,
        });
      }
    }
  }

  return NextResponse.json({ ok: failed.length === 0, sent, unlinked, failed, sentAt });
}
