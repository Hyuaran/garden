import type { CallRecordingAccess } from "./call-access";
import type { InnoveraCallRaw, InnoveraCircuit } from "./client";

export type NormalizedInnoveraCall = {
  id: string;
  uniqid: string;
  startTime: string | null;
  answerTime: string | null;
  endTime: string | null;
  displayTime: string;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  circuitId: string;
  circuitName: string;
  extension: string;
  counterpartNumber: string;
  counterpartName: string;
  talkSeconds: number | null;
  talkTimeLabel: string;
  hasRecording: boolean;
  inProgress: boolean;
  raw: InnoveraCallRaw;
};

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function validDateTime(value: unknown): string | null {
  const raw = text(value);
  if (!raw || raw === "0000-00-00 00:00:00") return null;
  return raw;
}

function parseSeconds(value: unknown): number | null {
  const raw = text(value);
  const match = /^(\d+):(\d{2}):(\d{2})$/.exec(raw);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function formatSeconds(value: number | null): string {
  if (value == null) return "-";
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function dateFromInnovera(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(" ", "T") + "+09:00");
  return Number.isNaN(date.getTime()) ? null : date;
}

function isNormalizedCall(call: InnoveraCallRaw | NormalizedInnoveraCall): call is NormalizedInnoveraCall {
  return "hasRecording" in call && "raw" in call && typeof call.raw === "object" && call.raw !== null;
}

export function formatCallType(value: unknown): string {
  const key = text(value);
  return ({
    "2": "発信",
    "3": "内線",
    "4": "保留",
    "5": "manager 間",
    "6": "自動応答",
    "7": "自動転送",
    "8": "自動留守録",
    "9": "会議",
  } as Record<string, string>)[key] ?? "着信";
}

export function formatDialStatus(value: unknown): string {
  const key = text(value);
  return ({
    "1": "通話成功",
    "2": "通話中に切断",
    "3": "不在",
  } as Record<string, string>)[key] ?? "-";
}

export function isOutbound(call: Pick<InnoveraCallRaw, "call_type">) {
  return text(call.call_type) === "2";
}

export function normalizeCall(raw: InnoveraCallRaw, now = new Date()): NormalizedInnoveraCall {
  const outbound = isOutbound(raw);
  const startTime = validDateTime(raw.start_time);
  const answerTime = validDateTime(raw.answer_time);
  const endTime = validDateTime(raw.end_time);
  const talkSeconds = parseSeconds(raw.talk_time);
  const extension = outbound ? text(raw.caller_num) : text(raw.callee_num);
  const counterpartNumber = outbound ? text(raw.callee_num) : text(raw.caller_num);
  const counterpartName = outbound ? text(raw.callee_name) : text(raw.caller_name);
  return {
    id: text(raw.id),
    uniqid: text(raw.uniqid),
    startTime,
    answerTime,
    endTime,
    displayTime: startTime ? startTime.slice(11, 16) : "-",
    type: text(raw.call_type),
    typeLabel: formatCallType(raw.call_type),
    status: text(raw.dial_status),
    statusLabel: formatDialStatus(raw.dial_status),
    circuitId: text(raw.circuit_id),
    circuitName: text(raw.circuit_name),
    extension,
    counterpartNumber,
    counterpartName,
    talkSeconds,
    talkTimeLabel: formatSeconds(talkSeconds),
    hasRecording: text(raw.record_file_flg) === "1",
    inProgress: !isCallFinished(raw, now),
    raw,
  };
}

export function isCallFinished(raw: Pick<InnoveraCallRaw, "end_time" | "start_time">, now = new Date()) {
  const endTime = validDateTime(raw.end_time);
  if (endTime) return true;
  const start = dateFromInnovera(validDateTime(raw.start_time));
  if (!start) return false;
  return now.getTime() - start.getTime() >= 60_000;
}

export function filterCallsForAccess<T extends InnoveraCallRaw>(
  calls: T[],
  access: CallRecordingAccess,
  ownExtension: string | null | undefined,
): T[] {
  if (access === "none") return [];
  if (access === "all" || access === "all_history_own_audio") return calls;
  const own = text(ownExtension);
  if (!own) return [];
  return calls.filter((call) => normalizeCall(call).extension === own);
}

export function canPlayRecording(
  call: InnoveraCallRaw | NormalizedInnoveraCall,
  access: CallRecordingAccess,
  ownExtension: string | null | undefined,
  now = new Date(),
) {
  if (access === "none") return false;
  const normalized = isNormalizedCall(call) ? call : normalizeCall(call, now);
  if (!normalized.hasRecording || !isCallFinished(normalized.raw, now)) return false;
  if (access === "all") return true;
  const own = text(ownExtension);
  return Boolean(own && normalized.extension === own);
}

export function allowedCircuitsForUser<T extends InnoveraCircuit>(circuits: T[], userId: string): T[] {
  const needle = `#${userId}#`;
  return circuits.filter((circuit) => text(circuit.out_users_id).includes(needle));
}
