export const TRAINING_HOURS_LABEL = "120h";

export const TEAMS = ["宮永チーム", "小泉チーム", "石原チーム"] as const;
export const FLAGS = ["いる", "いない"] as const;

export type PayrollNoticeTeam = (typeof TEAMS)[number];
export type PayrollNoticeFlag = (typeof FLAGS)[number];

export type CommutePerson = { name: string; station: string };
export type TrainingPerson = { name: string };
export type ReferralPerson = { name: string; referrer: string };

export type PayrollNoticeInput = {
  team: string;
  commuteFlag: string;
  commutePeople: CommutePerson[];
  trainingFlag: string;
  trainingPeople: TrainingPerson[];
  referralFlag: string;
  referralPeople: ReferralPerson[];
  otherNotes: string;
};

export type PayrollNoticeMessageInput = PayrollNoticeInput & {
  submitterName: string;
  submittedAt: Date;
};

export function normalizePayrollNoticeInput(input: Partial<PayrollNoticeInput>): PayrollNoticeInput {
  return {
    team: String(input.team ?? "").trim(),
    commuteFlag: String(input.commuteFlag ?? "").trim(),
    commutePeople: Array.isArray(input.commutePeople)
      ? input.commutePeople.map((person) => ({
          name: String(person?.name ?? "").trim(),
          station: String(person?.station ?? "").trim(),
        }))
      : [],
    trainingFlag: String(input.trainingFlag ?? "").trim(),
    trainingPeople: Array.isArray(input.trainingPeople)
      ? input.trainingPeople.map((person) => ({ name: String(person?.name ?? "").trim() }))
      : [],
    referralFlag: String(input.referralFlag ?? "").trim(),
    referralPeople: Array.isArray(input.referralPeople)
      ? input.referralPeople.map((person) => ({
          name: String(person?.name ?? "").trim(),
          referrer: String(person?.referrer ?? "").trim(),
        }))
      : [],
    otherNotes: String(input.otherNotes ?? "").trim(),
  };
}

export function validatePayrollNotice(input: PayrollNoticeInput): string[] {
  const errors: string[] = [];

  if (!TEAMS.includes(input.team as PayrollNoticeTeam)) {
    errors.push("「対象チーム」を選択してください。");
  }

  if (!FLAGS.includes(input.commuteFlag as PayrollNoticeFlag)) {
    errors.push("「交通費変更該当者」のいる／いないを選択してください。");
  } else if (input.commuteFlag === "いる") {
    if (input.commutePeople.length === 0) errors.push("「交通費変更該当者」の該当者を1人以上追加してください。");
    for (const person of input.commutePeople) {
      if (!person.name || !person.station) errors.push("「交通費変更該当者」は該当者名・通勤最寄り駅の両方を入力してください。");
    }
  }

  if (!FLAGS.includes(input.trainingFlag as PayrollNoticeFlag)) {
    errors.push("「研修中社員」のいる／いないを選択してください。");
  } else if (input.trainingFlag === "いる") {
    if (input.trainingPeople.length === 0) errors.push("「研修中社員」の該当者を1人以上追加してください。");
    for (const person of input.trainingPeople) {
      if (!person.name) errors.push("「研修中社員」は該当者名を入力してください。");
    }
  }

  if (!FLAGS.includes(input.referralFlag as PayrollNoticeFlag)) {
    errors.push("「紹介入社である社員」のいる／いないを選択してください。");
  } else if (input.referralFlag === "いる") {
    if (input.referralPeople.length === 0) errors.push("「紹介入社である社員」の該当者を1人以上追加してください。");
    for (const person of input.referralPeople) {
      if (!person.name || !person.referrer) errors.push("「紹介入社である社員」は該当者名・紹介者名の両方を入力してください。");
    }
  }

  if (!input.otherNotes) errors.push("「その他共有事項」を入力してください。");

  return [...new Set(errors)];
}

export function formatTokyoDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}/${Number(get("month"))}/${Number(get("day"))} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export function buildPayrollNoticeMessage(input: PayrollNoticeMessageInput) {
  const lines: string[] = [];
  lines.push("[info][title]給与計算に関する連絡[/title]");
  lines.push(`■対象チーム：${input.team || "（未選択）"}`);
  lines.push("");
  lines.push(`■交通費変更該当者：${input.commuteFlag}`);
  if (input.commuteFlag === "いる") {
    if (input.commutePeople.length === 0) {
      lines.push("　（該当者未入力）");
    } else {
      input.commutePeople.forEach((person) => {
        lines.push(`　・${person.name || "(氏名未入力)"}　通勤最寄り駅：${person.station || "(未入力)"}`);
      });
    }
  }
  lines.push("");
  lines.push(`■研修中社員(${TRAINING_HOURS_LABEL}＼1,500円/h該当者)：${input.trainingFlag}`);
  if (input.trainingFlag === "いる") {
    if (input.trainingPeople.length === 0) {
      lines.push("　（該当者未入力）");
    } else {
      input.trainingPeople.forEach((person) => lines.push(`　・${person.name || "(氏名未入力)"}`));
    }
  }
  lines.push("");
  lines.push(`■紹介入社である社員：${input.referralFlag}`);
  if (input.referralFlag === "いる") {
    if (input.referralPeople.length === 0) {
      lines.push("　（該当者未入力）");
    } else {
      input.referralPeople.forEach((person) => {
        lines.push(`　・該当者：${person.name || "(未入力)"}　紹介者：${person.referrer || "(未入力)"}`);
      });
    }
  }
  lines.push("");
  lines.push("■その他共有事項");
  lines.push(input.otherNotes || "（特になし）");
  lines.push(`[hr]送信者：${input.submitterName}　送信日時：${formatTokyoDateTime(input.submittedAt)}`);
  lines.push("[/info]");
  return lines.join("\n");
}

export function summarizeFlag(flag: string, count: number) {
  return flag === "いる" ? `${count}人` : "いない";
}
