import type { TransferStatus } from "../_constants/types";

export type TransitionErrorCode =
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "INVALID_TRANSITION"
  | "MISSING_REASON"
  | "DB_ERROR";

export interface TransitionParams {
  transferId: string;
  toStatus: TransferStatus;
  reason?: string | null;
}

export function validateTransitionInput(
  params: TransitionParams,
):
  | { ok: true }
  | { ok: false; code: TransitionErrorCode; error: string } {
  if (!params.transferId || params.transferId.trim() === "") {
    return { ok: false, code: "NOT_FOUND", error: "transferId が空です" };
  }
  if (params.toStatus === "差戻し" && !params.reason?.trim()) {
    return {
      ok: false,
      code: "MISSING_REASON",
      error: "差戻し理由を入力してください",
    };
  }
  return { ok: true };
}

export function mapPostgresErrorCode(
  pgCode: string | undefined,
  message: string | undefined,
): TransitionErrorCode {
  if (pgCode === "NO_DATA_FOUND") return "NOT_FOUND";
  if (pgCode === "INSUFFICIENT_PRIVILEGE") return "UNAUTHORIZED";
  if (pgCode === "CHECK_VIOLATION") return "INVALID_TRANSITION";
  if (pgCode === "INVALID_PARAMETER_VALUE") return "MISSING_REASON";
  if (message?.includes("invalid transition")) return "INVALID_TRANSITION";
  if (message?.includes("reason required")) return "MISSING_REASON";
  if (message?.includes("not registered")) return "UNAUTHORIZED";
  if (message?.includes("not found")) return "NOT_FOUND";
  return "DB_ERROR";
}
