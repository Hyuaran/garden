import { calculateNhkVisitTotals, weekdayLabel } from "./nhk-visit";

export type NhkVisitSummaryRow = {
  visit_date: string;
  start_time: string;
  end_time: string;
  destination: string;
  new_ground: number;
  new_satellite: number;
  address_ground: number;
  address_satellite: number;
  bank_credit: number;
  employee_number?: string | null;
  employee_name: string;
};

export type NhkVisitTotals = {
  newGround: number;
  newSatellite: number;
  newTotal: number;
  addressGround: number;
  addressSatellite: number;
  addressTotal: number;
  bankCredit: number;
  contractTotal: number;
};

export type NhkVisitPersonDaySummary = NhkVisitTotals & {
  employeeName: string;
  employeeNumber: string;
  destination: string;
  startTime: string;
  endTime: string;
  durationHours: number;
};

export type NhkVisitDaySummary = {
  date: string;
  people: NhkVisitPersonDaySummary[];
  totals: NhkVisitTotals;
  reportPeople: number;
  durationHours: number;
  destinationTotals: Map<string, number>;
};

export type NhkVisitMonthSummary = {
  month: string;
  people: { employeeName: string; employeeNumber: string; contractTotal: number }[];
  total: number;
  reportDays: number;
  destinationTotals: Map<string, number>;
};

export type NhkVisitAnalysis = {
  previousDayTotal: number;
  previousDayDiff: number;
  previousWeekTotal: number;
  previousWeekDiff: number;
  dailyAverage: number;
  monthEndProjection: number;
  hourlyRate: number | null;
};

function rowDate(value: string) {
  return value.slice(0, 10);
}

function rowMonth(value: string) {
  return rowDate(value).slice(0, 7);
}

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function minutesOf(value: string) {
  const [hour, minute] = normalizeTime(value).split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

function durationHours(startTime: string, endTime: string) {
  const diff = minutesOf(endTime) - minutesOf(startTime);
  return diff > 0 ? diff / 60 : 0;
}

function emptyTotals(): NhkVisitTotals {
  return { newGround: 0, newSatellite: 0, newTotal: 0, addressGround: 0, addressSatellite: 0, addressTotal: 0, bankCredit: 0, contractTotal: 0 };
}

function addToTotals(totals: NhkVisitTotals, row: NhkVisitSummaryRow) {
  const rowTotals = calculateNhkVisitTotals({
    newGround: Number(row.new_ground) || 0,
    newSatellite: Number(row.new_satellite) || 0,
    addressGround: Number(row.address_ground) || 0,
    addressSatellite: Number(row.address_satellite) || 0,
    bankCredit: Number(row.bank_credit) || 0,
  });
  totals.newGround += Number(row.new_ground) || 0;
  totals.newSatellite += Number(row.new_satellite) || 0;
  totals.newTotal += rowTotals.newTotal;
  totals.addressGround += Number(row.address_ground) || 0;
  totals.addressSatellite += Number(row.address_satellite) || 0;
  totals.addressTotal += rowTotals.addressTotal;
  totals.bankCredit += Number(row.bank_credit) || 0;
  totals.contractTotal += rowTotals.contractTotal;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

export function summarizeDay(rows: NhkVisitSummaryRow[], date: string): NhkVisitDaySummary {
  const matchingRows = rows.filter((row) => rowDate(row.visit_date) === date);
  const totals = emptyTotals();
  const peopleMap = new Map<string, NhkVisitPersonDaySummary>();
  const reportEmployees = new Set<string>();
  const destinationTotals = new Map<string, number>();
  let totalDurationHours = 0;

  for (const row of matchingRows) {
    addToTotals(totals, row);
    const rowTotal = calculateNhkVisitTotals({
      newGround: Number(row.new_ground) || 0,
      newSatellite: Number(row.new_satellite) || 0,
      addressGround: Number(row.address_ground) || 0,
      addressSatellite: Number(row.address_satellite) || 0,
      bankCredit: Number(row.bank_credit) || 0,
    }).contractTotal;
    const employeeNumber = String(row.employee_number ?? "");
    const employeeKey = employeeNumber || row.employee_name;
    reportEmployees.add(employeeKey);
    destinationTotals.set(row.destination, (destinationTotals.get(row.destination) ?? 0) + rowTotal);
    totalDurationHours += durationHours(row.start_time, row.end_time);

    const key = `${employeeKey}\u0000${row.employee_name}\u0000${row.destination}`;
    const existing = peopleMap.get(key);
    if (existing) {
      addToTotals(existing, row);
      existing.startTime = minutesOf(row.start_time) < minutesOf(existing.startTime) ? normalizeTime(row.start_time) : existing.startTime;
      existing.endTime = minutesOf(row.end_time) > minutesOf(existing.endTime) ? normalizeTime(row.end_time) : existing.endTime;
      existing.durationHours += durationHours(row.start_time, row.end_time);
    } else {
      const person = {
        employeeName: row.employee_name,
        employeeNumber,
        destination: row.destination,
        startTime: normalizeTime(row.start_time),
        endTime: normalizeTime(row.end_time),
        durationHours: durationHours(row.start_time, row.end_time),
        ...emptyTotals(),
      };
      addToTotals(person, row);
      peopleMap.set(key, person);
    }
  }

  return {
    date,
    people: [...peopleMap.values()],
    totals,
    reportPeople: reportEmployees.size,
    durationHours: round1(totalDurationHours),
    destinationTotals,
  };
}

export function summarizeMonth(rows: NhkVisitSummaryRow[], month: string): NhkVisitMonthSummary {
  const peopleMap = new Map<string, { employeeName: string; employeeNumber: string; contractTotal: number }>();
  const reportDays = new Set<string>();
  const destinationTotals = new Map<string, number>();
  let total = 0;

  for (const row of rows.filter((item) => rowMonth(item.visit_date) === month)) {
    reportDays.add(rowDate(row.visit_date));
    const rowTotal = calculateNhkVisitTotals({
      newGround: Number(row.new_ground) || 0,
      newSatellite: Number(row.new_satellite) || 0,
      addressGround: Number(row.address_ground) || 0,
      addressSatellite: Number(row.address_satellite) || 0,
      bankCredit: Number(row.bank_credit) || 0,
    }).contractTotal;
    total += rowTotal;
    destinationTotals.set(row.destination, (destinationTotals.get(row.destination) ?? 0) + rowTotal);
    const employeeNumber = String(row.employee_number ?? "");
    const employeeKey = employeeNumber || row.employee_name;
    const existing = peopleMap.get(employeeKey);
    if (existing) {
      existing.contractTotal += rowTotal;
    } else {
      peopleMap.set(employeeKey, { employeeName: row.employee_name, employeeNumber, contractTotal: rowTotal });
    }
  }

  return {
    month,
    people: [...peopleMap.values()],
    total,
    reportDays: reportDays.size,
    destinationTotals,
  };
}

export function analyze(rows: NhkVisitSummaryRow[], date: string): NhkVisitAnalysis {
  const day = summarizeDay(rows, date);
  const month = summarizeMonth(rows, date.slice(0, 7));
  const previousDayTotal = summarizeDay(rows, addDays(date, -1)).totals.contractTotal;
  const previousWeekTotal = summarizeDay(rows, addDays(date, -7)).totals.contractTotal;
  const dailyAverage = month.reportDays > 0 ? round1(month.total / month.reportDays) : 0;
  return {
    previousDayTotal,
    previousDayDiff: day.totals.contractTotal - previousDayTotal,
    previousWeekTotal,
    previousWeekDiff: day.totals.contractTotal - previousWeekTotal,
    dailyAverage,
    monthEndProjection: Math.round(dailyAverage * daysInMonth(date.slice(0, 7))),
    hourlyRate: day.durationHours > 0 ? round1(day.totals.contractTotal / day.durationHours) : null,
  };
}

function signed(value: number) {
  return value > 0 ? `＋${value}` : String(value).replace("-", "−");
}

function monthRange(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month}/1〜${month}/${day}`;
}

function destinationAnalysis(day: NhkVisitDaySummary, month: NhkVisitMonthSummary) {
  const destinations = new Set([...day.destinationTotals.keys(), ...month.destinationTotals.keys()]);
  if (destinations.size === 0) return "なし";
  return [...destinations].map((destination) => `${destination} ${day.destinationTotals.get(destination) ?? 0}／${month.destinationTotals.get(destination) ?? 0}`).join("・");
}

function detailText(total: number, ground: number, satellite: number) {
  return total > 0 ? `${total}（地上${ground}・衛星${satellite}）` : "0";
}

export function buildNhkVisitChatworkSummary(rows: NhkVisitSummaryRow[], date: string) {
  const day = summarizeDay(rows, date);
  const month = summarizeMonth(rows, date.slice(0, 7));
  const insight = analyze(rows, date);
  const displayDate = date.replace(/-/g, "/");
  const lines = [`[info][title]NHK訪問業務 集計（${displayDate} ${weekdayLabel(date)}）[/title]`];

  if (day.reportPeople === 0) {
    lines.push("本日の報告はまだありません");
  } else {
    lines.push(`■ 本日の報告　${day.reportPeople} 人`, "");
    for (const person of day.people) {
      lines.push(`${person.employeeName}　${person.destination}　${person.startTime}-${person.endTime}`);
      if (person.contractTotal === 0) {
        lines.push("　新規 0／住所変更 0／口座・クレ 0　＝ 0 件");
      } else {
        lines.push(`　新規 ${detailText(person.newTotal, person.newGround, person.newSatellite)}／住所変更 ${detailText(person.addressTotal, person.addressGround, person.addressSatellite)}／口座・クレ ${person.bankCredit}　＝ ${person.contractTotal} 件`);
      }
    }
    lines.push("", `本日の合計　新規 ${day.totals.newTotal}・住所変更 ${day.totals.addressTotal}・口座クレ ${day.totals.bankCredit}　＝ ${day.totals.contractTotal} 件`);
  }

  lines.push("", `■ 今月の累計（${monthRange(date)}）`);
  lines.push(month.people.length > 0 ? month.people.map((person) => `${person.employeeName}　${person.contractTotal} 件`).join("／") : "まだ報告はありません");
  lines.push(`合計　${month.total} 件（報告のあった日数 ${month.reportDays} 日）`);
  lines.push("", "■ 見立て");
  lines.push(`・前日 ${insight.previousDayTotal} 件 → 本日 ${day.totals.contractTotal} 件（${signed(insight.previousDayDiff)}）。先週の${weekdayLabel(date)}曜は ${insight.previousWeekTotal} 件（${signed(insight.previousWeekDiff)}）`);
  lines.push(`・今月は 1 日あたり ${insight.dailyAverage.toFixed(1)} 件。このペースだと月末は ${insight.monthEndProjection} 件`);
  lines.push(`・派遣先別（本日／今月）　${destinationAnalysis(day, month)}`);
  lines.push(`・1 時間あたり ${insight.hourlyRate === null ? "—" : insight.hourlyRate.toFixed(1)} 件（本日の稼働 ${day.durationHours.toFixed(1)} 時間）`);
  lines.push("[/info]");
  return lines.join("\n");
}

export function buildNhkVisitLineDailySummary(rows: NhkVisitSummaryRow[], date: string) {
  const day = summarizeDay(rows, date);
  const month = summarizeMonth(rows, date.slice(0, 7));
  const average = month.reportDays > 0 ? round1(month.total / month.reportDays) : 0;
  const lines = [`NHK訪問業務 集計（${date.replace(/-/g, "/")} ${weekdayLabel(date)}）`, ""];
  if (day.reportPeople === 0) {
    lines.push("本日の報告はまだありません");
  } else {
    lines.push(`本日の報告 ${day.reportPeople} 人`);
    for (const person of day.people) {
      if (person.contractTotal === 0) {
        lines.push(`${person.employeeName}　${person.destination}　0件`);
      } else {
        lines.push(`${person.employeeName}　${person.destination}　新規${person.newTotal}・住所${person.addressTotal}・口座${person.bankCredit}＝${person.contractTotal}件`);
      }
    }
  }
  lines.push("", `本日の合計 ${day.totals.contractTotal} 件`);
  lines.push(`今月の累計 ${month.total} 件（1日あたり ${average.toFixed(1)} 件）`);
  const body = lines.join("\n");
  return body.length > 5000 ? `${body.slice(0, 4992)}…（以下省略）` : body;
}

export function buildNhkVisitLineMonthSummary(rows: NhkVisitSummaryRow[], month: string) {
  const summary = summarizeMonth(rows, month);
  const average = summary.reportDays > 0 ? round1(summary.total / summary.reportDays) : 0;
  const lines = [
    `NHK訪問業務 今月の集計（${Number(month.slice(5, 7))}月）`,
    "",
    summary.people.length > 0 ? summary.people.map((person) => `${person.employeeName}　${person.contractTotal}件`).join("\n") : "まだ報告はありません",
    "",
    `合計 ${summary.total} 件（報告のあった日数 ${summary.reportDays} 日）`,
    `1日あたり ${average.toFixed(1)} 件`,
  ];
  const body = lines.join("\n");
  return body.length > 5000 ? `${body.slice(0, 4992)}…（以下省略）` : body;
}
