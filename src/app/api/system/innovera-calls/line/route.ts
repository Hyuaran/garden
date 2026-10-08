import { NextResponse } from "next/server";
import { isRoleAtLeast } from "@/app/root/_constants/types";
import { allowedCircuitsForUser } from "@/lib/innovera/calls";
import {
  listInnoveraCircuits,
  listInnoveraUsers,
  setInnoveraDefaultCircuit,
  type InnoveraCircuit,
} from "@/lib/innovera/client";
import { callAccessErrorResponse, requireCallAccess } from "@/lib/innovera/calls.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown) {
  return value == null ? "" : String(value);
}

async function targetEmployee(ctx: Awaited<ReturnType<typeof requireCallAccess>>, employeeId: string | null) {
  if (employeeId && employeeId !== ctx.employeeId && !isRoleAtLeast(ctx.role, "manager")) {
    return { error: NextResponse.json({ ok: false, error: "他の従業員の変更権限がありません" }, { status: 403 }) };
  }
  const targetId = employeeId || ctx.employeeId;
  const { data, error } = await getSupabaseAdmin()
    .from("root_employees")
    .select("employee_id,name,innovera_extension")
    .eq("employee_id", targetId)
    .maybeSingle();
  if (error || !data) return { error: NextResponse.json({ ok: false, error: "従業員が見つかりません" }, { status: 404 }) };
  if (!data.innovera_extension) {
    return { error: NextResponse.json({ ok: false, error: "内線番号が登録されていません。管理者へ問い合わせてください。" }, { status: 400 }) };
  }
  return { employee: data };
}

function findUserByExtension(users: Awaited<ReturnType<typeof listInnoveraUsers>>, extension: string) {
  return users.find((user) => text(user.number) === extension);
}

function circuitSummary(circuit: InnoveraCircuit) {
  return {
    id: text(circuit.id),
    name: text(circuit.name),
    number: text(circuit.number),
    freeNumber: text(circuit.free_number),
    circuitNum: text(circuit.circuit_num),
  };
}

export async function GET(request: Request) {
  try {
    const ctx = await requireCallAccess();
    const employeeId = new URL(request.url).searchParams.get("employeeId");
    const target = await targetEmployee(ctx, employeeId);
    if (target.error) return target.error;
    const employee = target.employee;
    const [users, circuits] = await Promise.all([listInnoveraUsers(), listInnoveraCircuits()]);
    const user = findUserByExtension(users, text(employee.innovera_extension));
    if (!user) return NextResponse.json({ ok: false, error: "INNOVERA ユーザーが見つかりません" }, { status: 404 });
    const allowed = allowedCircuitsForUser(circuits, text(user.id));
    const current = circuits.find((circuit) => text(circuit.id) === text(user.default_circuit_id)) ?? null;
    return NextResponse.json({
      ok: true,
      employee: { id: employee.employee_id, name: employee.name, extension: employee.innovera_extension },
      user: { id: user.id, name: user.name, number: user.number },
      current: current ? circuitSummary(current) : null,
      circuits: allowed.map(circuitSummary),
    });
  } catch (error) {
    try {
      return callAccessErrorResponse(error);
    } catch {
      return NextResponse.json({ ok: false, error: "INNOVERA に接続できませんでした" }, { status: 500 });
    }
  }
}

export async function POST(request: Request) {
  let ctx: Awaited<ReturnType<typeof requireCallAccess>> | null = null;
  let employeeId = "";
  let circuitId = "";
  let userId = "";
  let fromCircuit: InnoveraCircuit | null = null;
  let toCircuit: InnoveraCircuit | null = null;
  try {
    ctx = await requireCallAccess();
    const body = await request.json().catch(() => null) as { circuitId?: unknown; employeeId?: unknown } | null;
    circuitId = text(body?.circuitId);
    employeeId = text(body?.employeeId);
    if (!circuitId) return NextResponse.json({ ok: false, error: "circuitId is required" }, { status: 400 });
    const target = await targetEmployee(ctx, employeeId || null);
    if (target.error) return target.error;
    employeeId = text(target.employee.employee_id);

    const [users, circuits] = await Promise.all([listInnoveraUsers(), listInnoveraCircuits()]);
    const user = findUserByExtension(users, text(target.employee.innovera_extension));
    if (!user) return NextResponse.json({ ok: false, error: "INNOVERA ユーザーが見つかりません" }, { status: 404 });
    userId = text(user.id);
    const allowed = allowedCircuitsForUser(circuits, userId);
    toCircuit = allowed.find((circuit) => text(circuit.id) === circuitId) ?? null;
    fromCircuit = circuits.find((circuit) => text(circuit.id) === text(user.default_circuit_id)) ?? null;
    if (!toCircuit) return NextResponse.json({ ok: false, error: "選べない回線です" }, { status: 400 });

    await setInnoveraDefaultCircuit(userId, circuitId);
    await getSupabaseAdmin().from("system_innovera_line_change_log").insert({
      changed_by_employee_id: ctx.employeeId,
      target_employee_id: employeeId,
      innovera_user_id: userId,
      from_circuit_id: fromCircuit ? text(fromCircuit.id) : null,
      from_circuit_name: fromCircuit ? text(fromCircuit.name) : null,
      to_circuit_id: circuitId,
      to_circuit_name: text(toCircuit.name),
      ok: true,
      error: null,
    });
    return NextResponse.json({ ok: true, current: circuitSummary(toCircuit) });
  } catch (error) {
    if (ctx && employeeId && circuitId) {
      await getSupabaseAdmin().from("system_innovera_line_change_log").insert({
        changed_by_employee_id: ctx.employeeId,
        target_employee_id: employeeId,
        innovera_user_id: userId,
        from_circuit_id: fromCircuit ? text(fromCircuit.id) : null,
        from_circuit_name: fromCircuit ? text(fromCircuit.name) : null,
        to_circuit_id: circuitId,
        to_circuit_name: toCircuit ? text(toCircuit.name) : null,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    try {
      return callAccessErrorResponse(error);
    } catch {
      return NextResponse.json({ ok: false, error: "発信番号を変更できませんでした" }, { status: 500 });
    }
  }
}
