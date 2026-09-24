import { NextResponse } from "next/server";
import { requireStaff } from "@/app/system/mypage/_lib/submission-server";
import {
  buildNhkVisitReportMessage,
  calculateNhkVisitTotals,
  NHK_VISIT_DESTINATIONS,
  NHK_VISIT_TASK_NAME,
  NHK_VISIT_TRANSPORT_FEES,
  type NhkVisitDestination,
  type NhkVisitTransportFee,
} from "@/app/system/forms/nhk-visit/_lib/nhk-visit";
import { createRecord, type KintoneRecord } from "@/lib/kintone/records";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type ValidInput = {
  visitDate: string;
  startTime: string;
  endTime: string;
  destination: NhkVisitDestination;
  newGround: number;
  newSatellite: number;
  addressGround: number;
  addressSatellite: number;
  bankCredit: number;
  transportFee: NhkVisitTransportFee;
};

const countKeys = ["newGround", "newSatellite", "addressGround", "addressSatellite", "bankCredit"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validTime(value: unknown) {
  if (typeof value !== "string") return false;
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return Boolean(match);
}

function asNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function validateBody(body: unknown): { input: ValidInput; error: null } | { input: null; error: string } {
  if (!isObject(body)) return { input: null, error: "入力内容を確認してください" };
  if (!validDate(body.visitDate)) return { input: null, error: "日付を正しく入力してください" };
  if (!validTime(body.startTime) || !validTime(body.endTime)) return { input: null, error: "時間を正しく入力してください" };
  if (!NHK_VISIT_DESTINATIONS.includes(body.destination as NhkVisitDestination)) {
    return { input: null, error: "派遣先を選んでください" };
  }
  if (!NHK_VISIT_TRANSPORT_FEES.includes(body.transportFee as NhkVisitTransportFee)) {
    return { input: null, error: "交通費を選んでください" };
  }
  const counts = Object.fromEntries(countKeys.map((key) => [key, asNonNegativeInteger(body[key])]));
  if (Object.values(counts).some((value) => value === null)) {
    return { input: null, error: "件数は 0 以上の整数で入力してください" };
  }
  return {
    input: {
      visitDate: String(body.visitDate),
      startTime: String(body.startTime),
      endTime: String(body.endTime),
      destination: body.destination as NhkVisitDestination,
      newGround: counts.newGround as number,
      newSatellite: counts.newSatellite as number,
      addressGround: counts.addressGround as number,
      addressSatellite: counts.addressSatellite as number,
      bankCredit: counts.bankCredit as number,
      transportFee: body.transportFee as NhkVisitTransportFee,
    },
    error: null,
  };
}

function kintoneRecord(input: ValidInput, inserted: { id: string; submitted_at: string }, employee: { employee_number: string; name: string }): KintoneRecord {
  const totals = calculateNhkVisitTotals(input);
  return {
    日付: { value: input.visitDate },
    開始時刻: { value: input.startTime },
    終了時刻: { value: input.endTime },
    派遣先: { value: input.destination },
    業務: { value: NHK_VISIT_TASK_NAME },
    新規_地上: { value: input.newGround },
    新規_衛星: { value: input.newSatellite },
    新規_計: { value: totals.newTotal },
    住所変更_地上: { value: input.addressGround },
    住所変更_衛星: { value: input.addressSatellite },
    住所変更_計: { value: totals.addressTotal },
    口座クレ: { value: input.bankCredit },
    成約_合計: { value: totals.contractTotal },
    交通費: { value: input.transportFee },
    報告者社員番号: { value: employee.employee_number },
    報告者氏名: { value: employee.name },
    報告日時: { value: inserted.submitted_at },
    Garden記録番号: { value: inserted.id },
  };
}

function todayJst() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "ログインが必要です" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const validation = validateBody(body);
  if (!validation.input) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  const input = validation.input;

  const admin = getSupabaseAdmin();
  const { data: inserted, error: insertError } = await admin
    .from("system_nhk_visit_report")
    .insert({
      visit_date: input.visitDate,
      start_time: input.startTime,
      end_time: input.endTime,
      destination: input.destination,
      task_name: NHK_VISIT_TASK_NAME,
      new_ground: input.newGround,
      new_satellite: input.newSatellite,
      address_ground: input.addressGround,
      address_satellite: input.addressSatellite,
      bank_credit: input.bankCredit,
      transport_fee: input.transportFee,
      employee_number: String(staff.employee_number),
      employee_name: String(staff.name),
      submitted_by: staff.userId,
    })
    .select("id,submitted_at,visit_date,start_time,end_time,destination,task_name,new_ground,new_satellite,address_ground,address_satellite,bank_credit,transport_fee,employee_number,employee_name")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ ok: false, error: "記録を保存できませんでした" }, { status: 500 });
  }

  const message = buildNhkVisitReportMessage({
    visitDate: String(inserted.visit_date),
    startTime: String(inserted.start_time).slice(0, 5),
    endTime: String(inserted.end_time).slice(0, 5),
    destination: inserted.destination as NhkVisitDestination,
    taskName: String(inserted.task_name),
    newGround: Number(inserted.new_ground),
    newSatellite: Number(inserted.new_satellite),
    addressGround: Number(inserted.address_ground),
    addressSatellite: Number(inserted.address_satellite),
    bankCredit: Number(inserted.bank_credit),
    transportFee: inserted.transport_fee as NhkVisitTransportFee,
  });

  let kintoneStatus: "synced" | "pending" = "synced";
  try {
    const token = process.env.KINTONE_NHK_VISIT_REPORT_TOKEN ?? "";
    const result = await createRecord(241, token, kintoneRecord(input, inserted, {
      employee_number: String(staff.employee_number),
      name: String(staff.name),
    }));
    await admin
      .from("system_nhk_visit_report")
      .update({ kintone_record_id: result.id, kintone_synced_at: new Date().toISOString(), kintone_error: null })
      .eq("id", inserted.id);
  } catch (error) {
    kintoneStatus = "pending";
    await admin
      .from("system_nhk_visit_report")
      .update({ kintone_error: error instanceof Error ? error.message : String(error) })
      .eq("id", inserted.id);
  }

  return NextResponse.json({
    ok: true,
    kintoneStatus,
    message,
    report: inserted,
  });
}

export async function GET(request: Request) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ ok: false, error: "ログインが必要です" }, { status: 403 });

  const url = new URL(request.url);
  if (url.searchParams.get("mine") !== "1") {
    return NextResponse.json({ ok: false, error: "表示できる履歴がありません" }, { status: 400 });
  }

  const today = todayJst();
  const since = addDays(today, -6);
  const { data, error } = await getSupabaseAdmin()
    .from("system_nhk_visit_report")
    .select("id,visit_date,start_time,end_time,destination,task_name,new_ground,new_satellite,address_ground,address_satellite,bank_credit,transport_fee,submitted_at,kintone_record_id,kintone_synced_at,kintone_error")
    .eq("submitted_by", staff.userId)
    .gte("visit_date", since)
    .lte("visit_date", today)
    .order("visit_date", { ascending: false })
    .order("submitted_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: "直近の報告を読み込めませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, reports: data ?? [] });
}
