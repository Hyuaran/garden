import { NextResponse } from "next/server";
import { isRoleAtLeast } from "@/app/root/_constants/types";
import {
  canPlayRecording,
  filterCallsForAccess,
  normalizeCall,
  type NormalizedInnoveraCall,
} from "@/lib/innovera/calls";
import type { InnoveraCallRaw } from "@/lib/innovera/client";
import { searchInnoveraCalls } from "@/lib/innovera/client";
import type { CallAccessContext } from "@/lib/innovera/calls.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export function tokyoToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function validateDate(value: string | null) {
  const date = value || tokyoToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("日付の形式が正しくありません");
  const target = new Date(`${date}T00:00:00+09:00`);
  const today = new Date(`${tokyoToday()}T00:00:00+09:00`);
  const oldest = new Date(today);
  oldest.setFullYear(oldest.getFullYear() - 1);
  if (target.getTime() < oldest.getTime()) throw new Error("1年より前の履歴は表示できません");
  return date;
}

export function dayRange(date: string) {
  return {
    from: `${date} 00:00:00`,
    to: `${date} 23:59:59`,
  };
}

export async function employeeNameByExtension(
  supabase: CallAccessContext["supabase"],
  calls: NormalizedInnoveraCall[],
) {
  const extensions = Array.from(new Set(calls.map((call) => call.extension).filter(Boolean)));
  if (!extensions.length) return new Map<string, string>();
  void supabase;
  const { data } = await getSupabaseAdmin()
    .from("root_employees")
    .select("name,innovera_extension")
    .in("innovera_extension", extensions);
  return new Map((data ?? []).map((row) => [String(row.innovera_extension), String(row.name ?? "")]));
}

export function counts(calls: NormalizedInnoveraCall[]) {
  return {
    total: calls.length,
    success: calls.filter((call) => call.status === "1").length,
    missed: calls.filter((call) => call.status === "3").length,
    inProgress: calls.filter((call) => call.inProgress).length,
  };
}

export function applyUiFilters(calls: NormalizedInnoveraCall[], searchParams: URLSearchParams, ownExtension: string | null) {
  const mine = searchParams.get("mine") === "1";
  const extension = searchParams.get("extension")?.trim() ?? "";
  const circuit = searchParams.get("circuit")?.trim() ?? "";
  const type = searchParams.get("type")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const number = searchParams.get("number")?.replace(/\D/g, "") ?? "";
  return calls.filter((call) => {
    if (mine && ownExtension && call.extension !== ownExtension) return false;
    if (extension && call.extension !== extension) return false;
    if (circuit && call.circuitId !== circuit) return false;
    if (type && call.type !== type) return false;
    if (status && call.status !== status) return false;
    if (number) {
      const haystack = `${call.counterpartNumber} ${call.extension}`.replace(/\D/g, "");
      if (!haystack.includes(number)) return false;
    }
    return true;
  });
}

export async function loadAllowedCallsForDate(ctx: CallAccessContext, date: string, uniqid?: string) {
  const range = dayRange(date);
  const rawCalls = await searchInnoveraCalls({ ...range, uniqid });
  const allowed = filterCallsForAccess(rawCalls, ctx.access, ctx.ownExtension);
  const normalized = allowed.map((call) => normalizeCall(call));
  const names = await employeeNameByExtension(ctx.supabase, normalized);
  return normalized.map((call) => ({
    ...call,
    employeeName: names.get(call.extension) || call.extension,
    canPlay: canPlayRecording(call, ctx.access, ctx.ownExtension),
  }));
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function ensureOtherEmployeeAllowed(ctx: CallAccessContext, employeeId: string | null) {
  if (employeeId && employeeId !== ctx.employeeId && !isRoleAtLeast(ctx.role, "manager")) {
    throw new Error("他の従業員の変更権限がありません");
  }
}

export type ApiCall = ReturnType<typeof normalizeCall> & {
  employeeName: string;
  canPlay: boolean;
};

export function findByUniqid(calls: InnoveraCallRaw[], uniqid: string) {
  return calls.find((call) => String(call.uniqid ?? "") === uniqid);
}
