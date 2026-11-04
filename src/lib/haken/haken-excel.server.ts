import ExcelJS from "exceljs";
import fields from "./ledger-fields.json";
import { workerDates } from "./ledger";
import type { HakenData, HakenWorker } from "./types";

export function ledgerValues(data: HakenData, worker: HakenWorker): string[] {
  const c = data.contracts.find((c) => c.id === worker.contract_id)!;
  const p = data.parties.find((p) => p.id === c.party_id)!;
  const o = data.offices.find((o) => o.id === c.office_id)!;
  const dates = workerDates(data, worker);
  const company =
    data.companies.find((company) => company.company_id === o.company_id)
      ?.company_name ?? "";
  const insurance = (value: boolean) => (value ? "あり" : "なし");
  return [
    worker.name,
    worker.gender === "male"
      ? "男"
      : worker.gender === "female"
        ? "女"
        : "未確認",
    worker.is_indefinite ? "無期雇用" : "有期雇用",
    worker.is_over_60 ? "60歳以上" : "60歳未満",
    worker.is_agreement ? "協定対象" : "対象外",
    `健康保険：${insurance(worker.health_insurance)}／厚生年金：${insurance(worker.pension)}／雇用保険：${insurance(worker.employment_insurance)} ${worker.insurance_reason}`,
    p.name,
    [p.name, p.office_name].filter(Boolean).join(" "),
    p.address,
    p.permit_no,
    [p.manager_name, p.manager_tel].join(" "),
    [p.complaint_name, p.complaint_tel].join(" "),
    [company, o.name].join(" "),
    o.address,
    c.org_unit,
    c.supervisor_name,
    c.commander_name,
    c.complaint_owner_name,
    c.work_content,
    c.responsibility,
    `${c.period_start} ～ ${c.period_end ?? "未定"}`,
    dates.office ?? "未定",
    dates.individual ?? "対象外",
    c.no_limit_reason || "該当なし",
    c.is_introduction ? "該当あり" : "該当なし",
    [c.work_days, c.work_hours, c.break_note, "就業記録は別途添付"]
      .filter(Boolean)
      .join("\n"),
    "「教育訓練・苦情」シートに記録",
    "「教育訓練・苦情」シートに記録",
    p.issue_defaults.supervisor_appointed_on || "未確認",
  ];
}

export async function generateHakenExcel(
  data: HakenData,
  workers: HakenWorker[],
) {
  const book = new ExcelJS.Workbook();
  book.creator = "Garden";
  const eventRows: string[][] = [];
  workers.forEach((worker, index) => {
    const name = worker.name.replace(/[\\/*?:\[\]]/g, "_").slice(0, 20);
    const sheet = book.addWorksheet(`${index + 1}_${name}`);
    const dates = workerDates(data, worker);
    sheet.addRow(["派遣先管理台帳（派遣法第42条）"]);
    sheet.addRow([`保存期限：${dates.retention ?? "派遣終了日から3年間"}`]);
    sheet.addRow(["区分", "項目", "内容", "備考"]);
    const values = ledgerValues(data, worker);
    fields.forEach(([category, label, sourceNote], i) => {
      let note = sourceNote;
      if (label === "派遣期間") note = "更新は終了1か月前に確認。";
      if (label === "事業所単位の抵触日")
        note = `通知した抵触日：${cNotified(data, worker)}`;
      if (label === "就業日・始業終業時刻・休憩時間")
        note =
          "就業記録は別途添付。月1回以上、派遣元へ写しを通知（法42条3項）。";
      sheet.addRow([category, label, values[i] ?? "", note]);
    });
    sheet.columns = [
      { width: 16 },
      { width: 43 },
      { width: 60 },
      { width: 42 },
    ];
    sheet.views = [{ state: "frozen", ySplit: 3 }];
    sheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
    for (const event of data.events.filter((e) => e.worker_id === worker.id)) {
      eventRows.push([
        worker.name,
        event.on_date,
        event.kind === "training" ? "教育訓練" : "苦情",
        event.content,
        event.handler,
        event.result,
        event.party_contact,
      ]);
    }
  });
  const worklog = book.addWorksheet("就業記録");
  worklog.addRow(["就業記録は別途添付"]);
  worklog.addRow(["氏名", "日付", "始業", "終業", "休憩", "備考"]);
  const events = book.addWorksheet("教育訓練・苦情");
  events.addRow([
    "氏名",
    "日付",
    "区分",
    "内容",
    "対応者",
    "結果・処理状況",
    "派遣元への連絡",
  ]);
  eventRows.forEach((row) => events.addRow(row));
  for (const sheet of book.worksheets) {
    if (sheet === events || sheet === worklog)
      sheet.columns.forEach((column) => {
        column.width = 28;
      });
    sheet.eachRow((row) => {
      let lines = 1;
      row.eachCell((cell, column) => {
        const available = Math.max(
          8,
          Math.floor((sheet.getColumn(column).width ?? 28) / 2),
        );
        lines = Math.max(
          lines,
          ...cell.text
            .split("\n")
            .map((line) => Math.max(1, Math.ceil(line.length / available))),
        );
        cell.alignment = { vertical: "top", wrapText: true };
        cell.font = { name: "游明朝", size: 11 };
      });
      row.height = Math.max(28, lines * 17 + 8);
    });
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

function cNotified(data: HakenData, worker: HakenWorker) {
  return (
    data.contracts.find((c) => c.id === worker.contract_id)
      ?.notified_conflict_on ?? "未通知"
  );
}
