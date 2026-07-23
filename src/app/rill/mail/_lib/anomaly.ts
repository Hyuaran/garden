import type { RillMailMessage } from "./types";

export const ANOMALY_THRESHOLD_HOURS = 48;
export const ANOMALY_LOOKBACK_DAYS = 30;

export type MailAnomalyKind = "要対応" | "確認中" | "状態なし";

export type MailAnomaly = RillMailMessage & {
  anomalyKind: MailAnomalyKind;
  elapsedDays: number;
};

export type MailAnomalyResponse = {
  anomalies: MailAnomaly[];
  counts: Record<MailAnomalyKind, number>;
};

export function anomalyKind(categories: string[]): MailAnomalyKind | null {
  if (categories.includes("処理済")) return null;
  if (categories.includes("要対応")) return "要対応";
  if (categories.includes("確認中")) return "確認中";
  return "状態なし";
}

export function detectMailAnomalies(
  messages: RillMailMessage[],
  nowMs = Date.now(),
): MailAnomalyResponse {
  const thresholdMs = ANOMALY_THRESHOLD_HOURS * 60 * 60 * 1000;
  const lookbackMs = ANOMALY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const anomalies = messages.flatMap((message): MailAnomaly[] => {
    if (message.box.id === "sent") return [];
    const receivedMs = Date.parse(message.receivedDateTime);
    const ageMs = nowMs - receivedMs;
    const kind = anomalyKind(message.categories);
    if (!Number.isFinite(receivedMs) || ageMs < thresholdMs || ageMs > lookbackMs || !kind) return [];
    return [{ ...message, anomalyKind: kind, elapsedDays: Math.floor(ageMs / (24 * 60 * 60 * 1000)) }];
  }).sort((left, right) => Date.parse(right.receivedDateTime) - Date.parse(left.receivedDateTime));

  return {
    anomalies,
    counts: {
      "要対応": anomalies.filter((item) => item.anomalyKind === "要対応").length,
      "確認中": anomalies.filter((item) => item.anomalyKind === "確認中").length,
      "状態なし": anomalies.filter((item) => item.anomalyKind === "状態なし").length,
    },
  };
}

export function anomalyStorageKeys(userId: string) {
  return {
    lastShown: `rill-mail-anomaly:last-shown:${userId}`,
    disabled: `rill-mail-anomaly:disabled:${userId}`,
  };
}

