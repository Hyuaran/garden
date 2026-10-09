import {
  isRoleAtLeast,
  type GardenRole,
} from "@/app/root/_constants/types";

export type CallRecordingAccess =
  | "all"
  | "all_history_own_audio"
  | "own"
  | "none";
export type CallRecordingOverride = "default" | CallRecordingAccess;

export const CALL_RECORDING_ACCESS_LABELS: Record<CallRecordingAccess, string> = {
  all: "全員の通話と録音",
  all_history_own_audio: "全員の履歴・自分の録音",
  own: "自分の通話と録音",
  none: "使わせない",
};

export const CALL_RECORDING_OVERRIDE_LABELS: Record<
  CallRecordingOverride,
  string
> = {
  default: "既定（役職どおり）",
  ...CALL_RECORDING_ACCESS_LABELS,
};

const CALL_RECORDING_ACCESS_VALUES = new Set<CallRecordingAccess>([
  "all",
  "all_history_own_audio",
  "own",
  "none",
]);

export function defaultCallRecordingAccess(
  role: GardenRole,
): CallRecordingAccess {
  if (isRoleAtLeast(role, "manager")) return "all";
  if (role === "staff") return "all_history_own_audio";
  if (role === "toss" || role === "closer" || role === "outsource") return "own";
  if (role === "cs") return "own";
  return "none";
}

export function resolveCallRecordingAccess(
  role: GardenRole,
  override: CallRecordingOverride | null | undefined,
): CallRecordingAccess {
  if (!override || override === "default") return defaultCallRecordingAccess(role);
  if (CALL_RECORDING_ACCESS_VALUES.has(override)) return override;
  return defaultCallRecordingAccess(role);
}

export function canSeeAllCalls(access: CallRecordingAccess): boolean {
  return access === "all" || access === "all_history_own_audio";
}

export function canPlayAllRecordings(access: CallRecordingAccess): boolean {
  return access === "all";
}

export function canUseCallScreen(access: CallRecordingAccess): boolean {
  return access !== "none";
}
