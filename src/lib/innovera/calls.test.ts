import { describe, expect, it } from "vitest";
import {
  allowedCircuitsForUser,
  canPlayRecording,
  filterCallsForAccess,
  isCallFinished,
  normalizeCall,
} from "./calls";
import type { InnoveraCallRaw } from "./client";

const baseCall: InnoveraCallRaw = {
  id: "cdr-1",
  uniqid: "u-1",
  caller_num: "2040",
  callee_num: "09012345678",
  caller_name: "Agent",
  callee_name: "Customer",
  call_type: "2",
  dial_status: "1",
  talk_time: "00:00:51",
  start_time: "2026-10-08 10:21:00",
  answer_time: "2026-10-08 10:21:10",
  end_time: "2026-10-08 10:22:01",
  record_file_flg: "1",
};

describe("innovera calls", () => {
  it("normalizes outbound and inbound calls for display", () => {
    const outbound = normalizeCall(baseCall);
    expect(outbound.extension).toBe("2040");
    expect(outbound.counterpartNumber).toBe("09012345678");
    expect(outbound.typeLabel).toBe("発信");
    expect(outbound.talkTimeLabel).toBe("0:51");

    const inbound = normalizeCall({ ...baseCall, call_type: "1", caller_num: "08011112222", callee_num: "2037" });
    expect(inbound.extension).toBe("2037");
    expect(inbound.counterpartNumber).toBe("08011112222");
  });

  it("treats empty end_time as unfinished until 60 seconds pass", () => {
    expect(isCallFinished({ start_time: "2026-10-08 10:00:00", end_time: "" }, new Date("2026-10-08T01:00:30Z"))).toBe(false);
    expect(isCallFinished({ start_time: "2026-10-08 10:00:00", end_time: "" }, new Date("2026-10-08T01:02:00Z"))).toBe(true);
    expect(isCallFinished({ start_time: "2026-10-08 10:00:00", end_time: "2026-10-08 10:00:10" })).toBe(true);
  });

  it("filters calls by access level", () => {
    const other = { ...baseCall, id: "cdr-2", caller_num: "2050" };
    expect(filterCallsForAccess([baseCall, other], "own", "2040")).toHaveLength(1);
    expect(filterCallsForAccess([baseCall, other], "all_history_own_audio", "2040")).toHaveLength(2);
    expect(filterCallsForAccess([baseCall], "none", "2040")).toHaveLength(0);
  });

  it("checks recording playback permission", () => {
    expect(canPlayRecording(baseCall, "all", null)).toBe(true);
    expect(canPlayRecording(baseCall, "all_history_own_audio", "2040")).toBe(true);
    expect(canPlayRecording(baseCall, "own", "2050")).toBe(false);
    expect(canPlayRecording({ ...baseCall, record_file_flg: "2" }, "all", null)).toBe(false);
    expect(canPlayRecording({ ...baseCall, end_time: "" }, "all", null, new Date("2026-10-08T01:00:30Z"))).toBe(false);
  });

  it("parses allowed circuit user id hashes", () => {
    expect(allowedCircuitsForUser([
      { id: "1", out_users_id: "#1#3#4#" },
      { id: "2", out_users_id: "#11#" },
    ], "1").map((circuit) => circuit.id)).toEqual(["1"]);
  });
});
