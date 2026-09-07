import { describe, expect, it } from "vitest";
import { buildPayrollNoticeMessage, normalizePayrollNoticeInput, validatePayrollNotice } from "./payroll-notice";

const submittedAt = new Date("2026-09-07T09:30:00.000Z");

describe("payroll notice message and validation", () => {
  it("builds the all-none message in the original Chatwork format", () => {
    const input = normalizePayrollNoticeInput({
      team: "宮永チーム",
      commuteFlag: "いない",
      trainingFlag: "いない",
      referralFlag: "いない",
      otherNotes: "今月は特になしです。",
    });

    expect(validatePayrollNotice(input)).toEqual([]);
    expect(buildPayrollNoticeMessage({ ...input, submitterName: "東海林 美琴", submittedAt })).toBe([
      "[info][title]給与計算に関する連絡[/title]",
      "■対象チーム：宮永チーム",
      "",
      "■交通費変更該当者：いない",
      "",
      "■研修中社員(150h＼1,500円/h該当者)：いない",
      "",
      "■紹介入社である社員：いない",
      "",
      "■その他共有事項",
      "今月は特になしです。",
      "[hr]送信者：東海林 美琴　送信日時：2026/9/7 18:30:00",
      "[/info]",
    ].join("\n"));
  });

  it("builds a message with two people in each applicable section", () => {
    const input = normalizePayrollNoticeInput({
      team: "石原チーム",
      commuteFlag: "いる",
      commutePeople: [
        { name: "山田太郎", station: "梅田駅～難波駅" },
        { name: "佐藤花子", station: "京都駅～大阪駅" },
      ],
      trainingFlag: "いる",
      trainingPeople: [{ name: "田中一郎" }, { name: "鈴木次郎" }],
      referralFlag: "いる",
      referralPeople: [
        { name: "高橋三郎", referrer: "山本四郎" },
        { name: "伊藤五郎", referrer: "渡辺六郎" },
      ],
      otherNotes: "確認をお願いします。",
    });

    const message = buildPayrollNoticeMessage({ ...input, submitterName: "東海林 美琴", submittedAt });

    expect(validatePayrollNotice(input)).toEqual([]);
    expect(message).toContain("　・山田太郎　通勤最寄り駅：梅田駅～難波駅");
    expect(message).toContain("　・佐藤花子　通勤最寄り駅：京都駅～大阪駅");
    expect(message).toContain("　・田中一郎");
    expect(message).toContain("　・鈴木次郎");
    expect(message).toContain("　・該当者：高橋三郎　紹介者：山本四郎");
    expect(message).toContain("　・該当者：伊藤五郎　紹介者：渡辺六郎");
  });

  it("returns the original required-field error wording", () => {
    const errors = validatePayrollNotice(normalizePayrollNoticeInput({
      commuteFlag: "いる",
      commutePeople: [{ name: "山田太郎", station: "" }],
      trainingFlag: "いる",
      trainingPeople: [],
      referralFlag: "いる",
      referralPeople: [{ name: "", referrer: "田中花子" }],
    }));

    expect(errors).toEqual([
      "「対象チーム」を選択してください。",
      "「交通費変更該当者」は該当者名・通勤最寄り駅の両方を入力してください。",
      "「研修中社員」の該当者を1人以上追加してください。",
      "「紹介入社である社員」は該当者名・紹介者名の両方を入力してください。",
      "「その他共有事項」を入力してください。",
    ]);
  });
});
