import { describe, expect, it } from "vitest";
import { anomalyKind, ANOMALY_THRESHOLD_HOURS, detectMailAnomalies } from "../anomaly";
import type { RillMailMessage } from "../types";

const NOW = Date.parse("2026-07-23T12:00:00.000Z");
const box = { id: "me", address: "me@example.com", label: "Me", kind: "personal" as const };

function message(id: string, hoursOld: number, categories: string[] = []): RillMailMessage {
  return {
    id, box, subject: id, fromName: "Sender", fromAddress: "sender@example.com", to: [],
    receivedDateTime: new Date(NOW - hoursOld * 60 * 60 * 1000).toISOString(),
    hasAttachments: false, isRead: true, categories, bodyPreview: "",
  };
}

describe("mail anomaly detection", () => {
  it("48時間以上の要対応・確認中・状態なしだけを検知する", () => {
    const result = detectMailAnomalies([
      message("new", ANOMALY_THRESHOLD_HOURS - 1),
      message("needs-action", 48, ["要対応"]),
      message("checking", 72, ["確認中"]),
      message("no-state", 96),
      message("done", 120, ["処理済"]),
      message("too-old", 31 * 24),
    ], NOW);

    expect(result.anomalies.map((item) => item.id)).toEqual(["needs-action", "checking", "no-state"]);
    expect(result.counts).toEqual({ "要対応": 1, "確認中": 1, "状態なし": 1 });
  });

  it("異常0件を返せる", () => {
    expect(detectMailAnomalies([message("done", 72, ["処理済"])], NOW)).toEqual({
      anomalies: [],
      counts: { "要対応": 0, "確認中": 0, "状態なし": 0 },
    });
  });

  it("処理済を他状態より優先して正常扱いする", () => {
    expect(anomalyKind(["要対応", "処理済"])).toBeNull();
  });
});

