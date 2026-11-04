import {
  addDays,
  conflictDate,
  conflictMismatch,
  hearingDue,
  individualConflictDate,
  renewalDue,
  retentionDue,
  todayJst,
} from "./rules";
import type { HakenData, HakenWorker } from "./types";

export function workerDates(data: HakenData, worker: HakenWorker) {
  const contract = data.contracts.find((c) => c.id === worker.contract_id);
  if (!contract) throw new Error("契約が見つかりません。");
  const officeContracts = data.contracts
    .filter((c) => c.side === "ukeire" && c.office_id === contract.office_id)
    .filter(
      (c) =>
        !data.workers.some(
          (w) => w.contract_id === c.id && w.deleted_at && !w.end_on,
        ),
    );
  const office = conflictDate(
    officeContracts.map((c) => ({ start: c.period_start, end: c.period_end })),
    contract.period_start,
  );
  // 社員との紐付けがない場合は氏名で継続を照合する。派遣会社は照合条件に含めない。
  const personal = data.workers
    .filter((w) => !(w.deleted_at && !w.end_on))
    .filter((w) =>
      worker.employee_id
        ? w.employee_id === worker.employee_id
        : !w.employee_id &&
          w.name.replace(/\s/g, "") === worker.name.replace(/\s/g, ""),
    )
    .filter((w) =>
      data.contracts.some(
        (c) =>
          c.id === w.contract_id &&
          c.side === "ukeire" &&
          c.org_unit === contract.org_unit,
      ),
    );
  const individual = individualConflictDate(
    personal.map((w) => ({ start: w.start_on, end: w.end_on })),
    worker.start_on,
    worker.is_indefinite,
    worker.is_over_60,
  );
  return {
    office,
    individual,
    hearing: office ? hearingDue(office) : null,
    renewal: contract.period_end ? renewalDue(contract.period_end) : null,
    retention: worker.end_on ? retentionDue(worker.end_on) : null,
    mismatch: conflictMismatch(office, contract.notified_conflict_on),
  };
}

export type HakenNotice = {
  key: string;
  due: string;
  kind: string;
  content: string;
  workerId: string;
};
export function ledgerNotices(
  data: HakenData,
  today = todayJst(),
): HakenNotice[] {
  const notices: HakenNotice[] = [];
  for (const worker of data.workers.filter((w) => !w.deleted_at)) {
    const c = data.contracts.find(
      (c) => c.id === worker.contract_id && c.side === "ukeire",
    );
    if (!c) continue;
    const dates = workerDates(data, worker);
    // 終わった契約は、更新の確認が要らない。
    if (dates.renewal && c.period_end && c.period_end >= today)
      notices.push({
        key: `renewal:${c.id}:${c.period_end}`,
        due: dates.renewal,
        kind: "契約の更新確認",
        content: `${worker.name}（終了 ${c.period_end}）`,
        workerId: worker.id,
      });
    const collected = data.documents.some(
      (d) =>
        d.contract_id === c.id &&
        d.doc_type === "individual" &&
        d.drive_url &&
        !d.save_error,
    );
    if (!collected)
      notices.push({
        key: `missing:${worker.id}`,
        due: addDays(worker.start_on, 7),
        kind: "個別契約書",
        content: `${worker.name}（未回収）`,
        workerId: worker.id,
      });
  }
  for (const office of data.offices) {
    const contracts = data.contracts
      .filter((c) => c.side === "ukeire" && c.office_id === office.id)
      .sort((a, b) => b.period_start.localeCompare(a.period_start));
    const worker = contracts
      .map((c) =>
        data.workers.find((w) => w.contract_id === c.id && !w.deleted_at),
      )
      .find(Boolean);
    if (!worker) continue;
    const dates = workerDates(data, worker);
    if (dates.hearing) {
      for (const days of [60, 0])
        notices.push({
          key: `hearing:${office.id}:${dates.hearing}:${days}`,
          due: addDays(dates.hearing, -days),
          kind: days ? "意見聴取の期限の60日前" : "意見聴取",
          content: office.name,
          workerId: worker.id,
        });
    }
    const notified =
      contracts.find((c) => c.notified_conflict_on)?.notified_conflict_on ??
      null;
    if (conflictMismatch(dates.office, notified))
      notices.push({
        key: `mismatch:${office.id}:${dates.office}:${notified}`,
        due: "",
        kind: "抵触日の確認",
        content: `${office.name}：通知した抵触日と違います`,
        workerId: worker.id,
      });
  }
  return Array.from(new Map(notices.map((n) => [n.key, n])).values()).sort(
    (a, b) => a.due.localeCompare(b.due),
  );
}
