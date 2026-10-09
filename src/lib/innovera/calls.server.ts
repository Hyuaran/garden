import { NextResponse } from "next/server";
import { createServerClient } from "@/app/_lib/supabase/server";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import { loadDailyExtensionWindows, needsDailyExtension, tokyoToday, type DailyExtensionWindow } from "@/lib/innovera/daily-extension";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  canUseCallScreen,
  resolveCallRecordingAccess,
  type CallRecordingAccess,
} from "./call-access";

export type CallAccessContext = {
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  employeeId: string;
  employeeName: string;
  role: GardenRole;
  access: CallRecordingAccess;
  ownExtension: string | null;
  ownExtensions: string[];
  ownWindows?: DailyExtensionWindow[];
  usesDailyExtension: boolean;
};

export class CallAccessError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function role(value: unknown): GardenRole {
  return String(value || "toss") as GardenRole;
}

function extensionList(...values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

export async function requireCallAccess(): Promise<CallAccessContext> {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new CallAccessError(401, "ログインしてください");

  const { data: employee, error } = await supabase
    .from("root_employees")
    .select("employee_id,name,garden_role,innovera_extension,innovera_mobile_extension,call_recording_access,is_active,termination_date,deleted_at")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new CallAccessError(500, "権限確認に失敗しました");
  if (!employee || !isEmployeeActive(employee)) throw new CallAccessError(403, "この画面へアクセスする権限がありません\n管理者へ問い合わせてください。");

  const access = resolveCallRecordingAccess(
    role(employee.garden_role),
    employee.call_recording_access,
  );
  if (!canUseCallScreen(access)) {
    throw new CallAccessError(403, "この画面へアクセスする権限がありません\n管理者へ問い合わせてください。");
  }
  const ownExtensions = extensionList(employee.innovera_extension, employee.innovera_mobile_extension);
  const employeeInfo = {
    id: String(employee.employee_id ?? ""),
    name: String(employee.name ?? ""),
    gardenRole: role(employee.garden_role),
    innoveraExtension: employee.innovera_extension ? String(employee.innovera_extension) : null,
    innoveraMobileExtension: employee.innovera_mobile_extension ? String(employee.innovera_mobile_extension) : null,
  };
  const usesDailyExtension = needsDailyExtension(employeeInfo);
  // 日ごとの内線の表は service_role しか読めない（RLS）ので、本人のセッションではなく管理クライアントで読む
  const ownWindows = usesDailyExtension ? await loadDailyExtensionWindows(getSupabaseAdmin(), employeeInfo.id, tokyoToday()) : [];
  const dailyExtensions = Array.from(new Set(ownWindows.map((window) => window.extension).filter(Boolean)));
  if (access !== "all" && ownExtensions.length === 0 && !usesDailyExtension) {
    throw new CallAccessError(403, "内線番号が登録されていません。管理者へ問い合わせてください。");
  }

  return {
    supabase,
    employeeId: String(employee.employee_id ?? ""),
    employeeName: String(employee.name ?? ""),
    role: role(employee.garden_role),
    access,
    // 日ごとの内線の人は、今日使用中（最後に登録した）の内線を PC 版の内線として扱う（発信番号の切替もその席のユーザで行う）
    ownExtension: usesDailyExtension
      ? (ownWindows.find((window) => !window.endedAt)?.extension ?? ownWindows[ownWindows.length - 1]?.extension ?? null)
      : (employee.innovera_extension ? String(employee.innovera_extension) : (employee.innovera_mobile_extension ? String(employee.innovera_mobile_extension) : null)),
    ownExtensions: dailyExtensions.length ? dailyExtensions : ownExtensions,
    ownWindows,
    usesDailyExtension,
  };
}

export function callAccessErrorResponse(error: unknown) {
  if (error instanceof CallAccessError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  throw error;
}

export function canManageOtherEmployee(roleValue: GardenRole) {
  return isRoleAtLeast(roleValue, "manager");
}

export function canViewMapping(roleValue: GardenRole) {
  return isRoleAtLeast(roleValue, "admin");
}
