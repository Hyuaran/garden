import { describe, expect, it } from "vitest";
import { parseKotDailyCsv, type KotDailyRow } from "@/app/system/kanri/_lib/kot-daily";
import {
  buildAttendanceMessage,
  buildLineShiftBlocks,
  formatFiveCharName,
  summarizeKotCoverage,
  type ShukkinMember,
} from "./shukkin";

const members: ShukkinMember[] = [
  { employeeNumber: "1001", name: "萩尾 拓也", groupName: "訪販社員", sortOrder: 10 },
  { employeeNumber: "1002", name: "桐井 大輔", groupName: "訪販社員", sortOrder: 20 },
  { employeeNumber: "1003", name: "東海林 美琴", groupName: "ＢＹ", sortOrder: 10 },
  { employeeNumber: "1004", name: "簡 棣榮", groupName: "ＢＹ", sortOrder: 20 },
  { employeeNumber: "1005", name: "上田 基人", groupName: "テレマ社員", sortOrder: 10 },
  { employeeNumber: "1006", name: "宮永 ひかり", groupName: "テレマ社員", sortOrder: 20 },
  { employeeNumber: "1007", name: "小泉 翔", groupName: "テレマ社員", sortOrder: 30 },
  { employeeNumber: "1008", name: "石原 孝志朗", groupName: "テレマ社員", sortOrder: 40 },
  { employeeNumber: "1390", name: "林 佳音", groupName: "宮永チーム", sortOrder: 10 },
  { employeeNumber: "1391", name: "南薗 優樹", groupName: "宮永チーム", sortOrder: 20 },
  { employeeNumber: "1392", name: "田中 実花", groupName: "小泉チーム", sortOrder: 10 },
  { employeeNumber: "1490", name: "藤木 誠希", groupName: "小泉チーム", sortOrder: 20 },
  { employeeNumber: "1525", name: "西野 紗良", groupName: "小泉チーム", sortOrder: 30 },
  { employeeNumber: "1600", name: "毛利 祐星", groupName: "石原チーム", sortOrder: 10 },
  { employeeNumber: "1601", name: "高木 麟心愛", groupName: "石原チーム", sortOrder: 20 },
];

const headers = [
  "従業員コード",
  "雇用区分",
  "名前",
  "日時（曜日なし）",
  "勤務日種別",
  "パターン名",
  "出勤予定時刻(時刻のみ)",
  "退勤予定時刻(時刻のみ)",
  "出勤打刻(丸め)(時刻のみ)",
  "退勤打刻(丸め)(時刻のみ)",
  "出勤時刻(時刻のみ)",
  "退勤時刻(時刻のみ)",
  "休憩時間",
  "労働予定時間",
  "労働合計時間",
  "所定時間",
  "遅刻時間",
  "早退時間",
  "労働時間予実差異",
];

function csv(rows: string[][]) {
  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

function row(code: string, name: string, date: string, kind: string, start = "", end = "", clockIn = "", rounded = "") {
  return [code, "アルバイト", name, date, kind, start ? "通常" : "", start, end, rounded, "", clockIn, "", "0", "0", "0", "0", "0", "0", "0"];
}

function parsed(rows: string[][]) {
  return parseKotDailyCsv(csv(rows));
}

describe("shukkin text builder", () => {
  it("formats names to five characters", () => {
    expect(formatFiveCharName("林 佳音")).toBe("林　　佳音");
    expect(formatFiveCharName("萩尾 拓也")).toBe("萩尾　拓也");
    expect(formatFiveCharName("東海林 美琴")).toBe("東海林美琴");
    expect(formatFiveCharName("小泉 翔")).toBe("小泉　　翔");
    expect(formatFiveCharName("高木 麟心愛")).toBe("高木麟心愛");
  });

  it("builds attendance header, rest labels, confirmation marks, and skips later starts", () => {
    const rows = parsed([
      row("1001", "萩尾 拓也", "2026/09/19", "平日", "10:00", "21:00", "10:00"),
      row("1002", "桐井 大輔", "2026/09/19", "平日", "10:00", "21:00", "10:05"),
      row("1003", "東海林 美琴", "2026/09/19", "公休"),
      row("1004", "簡 棣榮", "2026/09/19", "平日", "14:30", "21:00"),
      row("1005", "上田 基人", "2026/09/19", "平日", "14:00", "21:00"),
    ]);
    const text = buildAttendanceMessage({ rows, members: members.slice(0, 5), date: "2026-09-19", tableTime: "14:00", withConfirmation: true });
    expect(text).toContain("【出勤表】2026/09/19（土）14：00");
    expect(text).toContain("(東海林美琴)公休　");
    expect(text).toContain("(萩尾　拓也)10-21　○");
    expect(text).not.toContain("　 ○");
    expect(text).toContain("(桐井　大輔)10-21　※10：05打刻");
    expect(text).toContain("(上田　基人)14-21　※不明/打刻漏れの可能性");
    expect(text).toContain("(簡　　棣榮)14.5-21　");
    expect(text).not.toContain("(簡　　棣榮)14.5-21　※");
  });

  // 出勤表の時刻：分があるときは時間を小数で（09:30 → 9.5）。ちょうどの時は今までどおり 2 桁（東海林さん 2026-09-19）
  it("writes minutes as decimal hours in the attendance message", () => {
    const rows = parsed([
      row("1001", "萩尾 拓也", "2026/09/19", "平日", "09:30", "18:00"),
      row("1002", "桐井 大輔", "2026/09/19", "平日", "09:15", "17:45"),
      row("1003", "東海林 美琴", "2026/09/19", "平日", "09:00", "17:00"),
    ]);
    const text = buildAttendanceMessage({ rows, members: members.slice(0, 3), date: "2026-09-19", tableTime: "14:00", withConfirmation: false });
    expect(text).toContain("(萩尾　拓也)9.5-18　");
    expect(text).toContain("(桐井　大輔)9.25-17.75　");
    expect(text).toContain("(東海林美琴)09-17　");
    expect(text).not.toContain("09:30");
  });

  it("matches the 2026/09/19 14:00 fixture without confirmation", () => {
    const rows = parsed([
      row("1001", "萩尾 拓也", "2026/09/19", "平日", "09:00", "17:00"),
      row("1002", "桐井 大輔", "2026/09/19", "公休"),
      row("1003", "東海林 美琴", "2026/09/19", "公休"),
      row("1004", "簡 棣榮", "2026/09/19", "平日", "10:00", "21:00"),
      row("1005", "上田 基人", "2026/09/19", "平日", "14:00", "21:00"),
      row("1006", "宮永 ひかり", "2026/09/19", "平日", "14:00", "21:00"),
      row("1007", "小泉 翔", "2026/09/19", "平日", "14:00", "21:00"),
      row("1008", "石原 孝志朗", "2026/09/19", "平日", "14:00", "21:00"),
      row("1390", "林 佳音", "2026/09/19", "平日", "10:00", "21:00"),
      row("1391", "南薗 優樹", "2026/09/19", "欠勤"),
      row("1392", "田中 実花", "2026/09/19", "平日", "10:00", "21:00"),
      row("1490", "藤木 誠希", "2026/09/19", "平日", "14:00", "21:00"),
      row("1525", "西野 紗良", "2026/09/19", "平日", "14:00", "21:00"),
      row("1600", "毛利 祐星", "2026/09/19", "平日", "10:00", "21:00"),
      row("1601", "高木 麟心愛", "2026/09/19", "退職"),
    ]);
    expect(buildAttendanceMessage({ rows, members, date: "2026-09-19", tableTime: "14:00", withConfirmation: false })).toBe(`【出勤表】2026/09/19（土）14：00

＜訪販社員＞
(萩尾　拓也)09-17　
(桐井　大輔)×　

＜ＢＹ＞
(東海林美琴)公休　
(簡　　棣榮)10-21　

＜テレマ社員＞
(上田　基人)14-21　
(宮永ひかり)14-21　
(小泉　　翔)14-21　
(石原孝志朗)14-21　

＜宮永チーム＞
(林　　佳音)10-21　
(南薗　優樹)×　

＜小泉チーム＞
(田中　実花)10-21　
(藤木　誠希)14-21　
(西野　紗良)14-21　

＜石原チーム＞
(毛利　祐星)10-21　

【ヒュアラン予定】
なし

【面接予定】
なし

【研修予定】
なし

【上田予定】
なし

【後確予定】
なし`);
  });

  it("builds LINE shift blocks from the three team groups only", () => {
    const rows: KotDailyRow[] = parsed([
      row("1001", "萩尾 拓也", "2026/09/20", "平日", "10:00", "21:00"),
      row("1005", "上田 基人", "2026/09/20", "平日", "10:00", "21:00"),
      row("1390", "林 佳音", "2026/09/20", "平日", "14:00", "21:00"),
      row("1392", "田中 実花", "2026/09/20", "平日", "10:00", "21:00"),
      row("1490", "藤木 誠希", "2026/09/20", "平日", "14:00", "21:00"),
      row("1600", "毛利 祐星", "2026/09/20", "平日", "10:00", "21:00"),
    ]);
    const blocks = buildLineShiftBlocks({ rows, members, date: "2026-09-20" });
    expect(blocks.map((block) => block.shift)).toEqual(["10-21", "14-21"]);
    // ［コピー］で取る文面は送る 4 行だけ（シフトの見出しや送る相手は入れない）
    expect(blocks[0].message).toBe(`お疲れ様です！！
明日【09/20(日)】は
【10-21】の勤務シフトです。
本日21時までに出勤確認の返信を必ず下さい。`);
    expect(blocks[0].recipients).toEqual(["1392 田中 実花", "1600 毛利 祐星"]);
    expect(blocks[0].summary).toBe(`10-21
1392 田中 実花
1600 毛利 祐星

お疲れ様です！！
明日【09/20(日)】は
【10-21】の勤務シフトです。
本日21時までに出勤確認の返信を必ず下さい。`);
    expect(blocks.map((block) => block.summary).join("\n")).not.toContain("萩尾");
    expect(blocks.map((block) => block.summary).join("\n")).not.toContain("上田");
  });

  it("uses a half-width space in LINE names even when the roster name has a full-width space", () => {
    const rows: KotDailyRow[] = parsed([row("1392", "田中 実花", "2026/09/20", "平日", "10:00", "21:00")]);
    const fullWidth = members.map((member) => member.employeeNumber === "1392" ? { ...member, name: "田中　実花" } : member);
    const blocks = buildLineShiftBlocks({ rows, members: fullWidth, date: "2026-09-20" });
    expect(blocks[0].recipients).toContain("1392 田中 実花");
    expect(blocks[0].summary).not.toContain("田中　実花");
  });

  it("uses roster names first (even before a name change reaches the roster), then KOT names, then display names", () => {
    const rows = parsed([
      row("1510", "谷本 結那", "2026/09/20", "平日", "10:00", "21:00"),
      row("1555", "梶野 恵園", "2026/09/20", "平日", "14:00", "21:00"),
    ]);
    const targetMembers: ShukkinMember[] = [
      { employeeNumber: "1510", name: "萩原 結那", displayName: "谷本 結那", groupName: "石原チーム", sortOrder: 10 },
      { employeeNumber: "1555", name: "", displayName: "梶野 恵園", groupName: "小泉チーム", sortOrder: 10 },
      { employeeNumber: "1556", name: "", displayName: "藤田 悠誠", groupName: "石原チーム", sortOrder: 20 },
    ];

    const withKot = buildAttendanceMessage({ rows, members: targetMembers, date: "2026-09-20", tableTime: "14:00", withConfirmation: false });
    expect(withKot).toContain("(萩原　結那)10-21");
    expect(withKot).not.toContain("(谷本　結那)");
    expect(withKot).toContain("(梶野　恵園)14-21");

    const withoutKot = buildAttendanceMessage({ rows: [], members: targetMembers, date: "2026-09-21", tableTime: "14:00", withConfirmation: false });
    expect(withoutKot).toContain("(萩原　結那)×");
    expect(withoutKot).toContain("(藤田　悠誠)×");
  });

  it("uses display names for members missing from the roster in attendance and LINE messages", () => {
    const rows = parsed([
      row("1555", "梶野 恵園", "2026/09/20", "平日", "10:00", "21:00"),
    ]);
    const targetMembers: ShukkinMember[] = [
      { employeeNumber: "1555", name: "", displayName: "梶野 恵園", groupName: "小泉チーム", sortOrder: 10 },
    ];

    const attendance = buildAttendanceMessage({ rows: [], members: targetMembers, date: "2026-09-21", tableTime: "14:00", withConfirmation: false });
    expect(attendance).toContain("(梶野　恵園)×");

    const blocks = buildLineShiftBlocks({ rows, members: targetMembers, date: "2026-09-20" });
    expect(blocks[0].recipients).toContain("1555 梶野 恵園");
  });

  it("does not show SES division rows as missing from the order", () => {
    const rows = parsed([
      ["9001", "SES事業部", "対象 外", "2026/09/20", "平日", "通常", "10:00", "21:00", "", "", "", "", "0", "0", "0", "0", "0", "0", "0"],
      ["9002", "アルバイト", "追加 対象", "2026/09/20", "平日", "通常", "10:00", "21:00", "", "", "", "", "0", "0", "0", "0", "0", "0", "0"],
    ]);
    const coverage = summarizeKotCoverage({ rows, members: [], date: "2026-09-20" });
    expect(coverage.missingInOrder.map((item) => item.employeeCode)).toEqual(["9002"]);
  });

  // 退職の人は出勤表に出さない・並びに無い人にも出さない（東海林さん 2026-09-19）。
  // 実物の KOT では勤務日種別＝平日・パターン名＝退職（岩下 英美 1540 で確認）
  it("leaves retired people out of the attendance message and the not-in-order list", () => {
    const retired = (code: string, name: string, date: string) => {
      const value = row(code, name, date, "平日");
      value[5] = "退職";
      return value;
    };
    const rows = parsed([
      row("1600", "毛利 祐星", "2026/09/20", "平日", "10:00", "21:00"),
      retired("1601", "高木 麟心愛", "2026/09/20"),
      retired("1540", "岩下 英美", "2026/09/20"),
      row("1392", "田中 実花", "2026/09/20", "平日", "10:00", "21:00"),
    ]);
    const onlyRetiredInGroup: ShukkinMember[] = [
      ...members.filter((member) => member.groupName !== "石原チーム"),
      { employeeNumber: "1600", name: "毛利 祐星", groupName: "石原チーム", sortOrder: 10 },
      { employeeNumber: "1601", name: "高木 麟心愛", groupName: "石原チーム", sortOrder: 20 },
      { employeeNumber: "1557", name: "北野 晟", groupName: "新人チーム", sortOrder: 10 },
    ];
    const text = buildAttendanceMessage({ rows, members: onlyRetiredInGroup, date: "2026-09-20", tableTime: "14:00", withConfirmation: false });
    expect(text).toContain("(毛利　祐星)10-21　");
    expect(text).not.toContain("高木");
    expect(text).not.toContain("岩下");

    const retiredOnly = buildAttendanceMessage({
      rows,
      members: [{ employeeNumber: "1601", name: "高木 麟心愛", groupName: "石原チーム", sortOrder: 10 }],
      date: "2026-09-20",
      tableTime: "14:00",
      withConfirmation: false,
    });
    expect(retiredOnly).not.toContain("＜石原チーム＞");

    const coverage = summarizeKotCoverage({ rows, members: onlyRetiredInGroup, date: "2026-09-20" });
    expect(coverage.missingInOrder.map((item) => item.employeeCode)).toEqual([]);
  });

  it("puts 新人チーム after 石原チーム in the roster and includes it in LINE notices", () => {
    const rows = parsed([
      row("1600", "毛利 祐星", "2026/09/20", "平日", "10:00", "21:00"),
      row("1557", "北野 晟", "2026/09/20", "平日", "10:00", "21:00"),
    ]);
    const withNewcomer: ShukkinMember[] = [...members, { employeeNumber: "1557", name: "", displayName: "北野 晟", groupName: "新人チーム", sortOrder: 10 }];
    const text = buildAttendanceMessage({ rows, members: withNewcomer, date: "2026-09-20", tableTime: "14:00", withConfirmation: false });
    expect(text.indexOf("＜新人チーム＞")).toBeGreaterThan(text.indexOf("＜石原チーム＞"));
    expect(text.indexOf("＜新人チーム＞")).toBeLessThan(text.indexOf("【ヒュアラン予定】"));
    expect(text).toContain("(北野　　晟)10-21　");
    const blocks = buildLineShiftBlocks({ rows, members: withNewcomer, date: "2026-09-20" });
    expect(blocks[0].recipients).toContain("1557 北野 晟");
  });

  it("shows ＢＹ days without a plan as 公休 (blank or 平日 kind), rest kinds as their text, and others as ×", () => {
    const rows = parsed([
      row("1003", "東海林 美琴", "2026/09/19", ""),
      row("1004", "簡 棣榮", "2026/09/19", "平日"),
      row("1005", "上田 基人", "2026/09/19", ""),
    ]);
    const text = buildAttendanceMessage({ rows, members: members.slice(2, 5), date: "2026-09-19", tableTime: "14:00", withConfirmation: false });
    expect(text).toContain("(東海林美琴)公休　");
    expect(text).toContain("(簡　　棣榮)公休　");
    expect(text).toContain("(上田　基人)×　");
    expect(text).not.toContain("平日　");
    const paid = buildAttendanceMessage({ rows: parsed([row("1003", "東海林 美琴", "2026/09/19", "有給")]), members: members.slice(2, 3), date: "2026-09-19", tableTime: "14:00", withConfirmation: false });
    expect(paid).toContain("(東海林美琴)有給　");
  });
});
