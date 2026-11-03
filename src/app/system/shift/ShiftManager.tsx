"use client";
import { useEffect, useState, useRef } from "react";
import {
  useSystemView,
  SystemViewButton,
} from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import UpdatedStamp from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import Modal from "@/app/system/_components/Modal/Modal";
import { useUrlTab } from "@/app/system/_components/SystemTabs/useUrlTab";
import {
  ActionButton,
  SubmitButton,
  ResultMessage,
  formStyles,
} from "@/app/system/forms/_components/form-kit";
import LineSendOverlay, {
  type LineSendState,
} from "@/app/system/line/LineSendOverlay";
import type { ShiftEmployee } from "@/lib/shift/eligibility";
import { stamp, hours, weekend, type ShiftDay } from "@/lib/shift/rules";
import MyShift, { shiftMonths } from "./MyShift";
import ShiftDays, { shiftDate } from "./ShiftDays";
import "./shift.css";
type TeamData = {
  people: ShiftEmployee[];
  days: string[];
  wish: (ShiftDay & { employee_id: string; updated_at?: string })[];
  confirmed: (ShiftDay & { employee_id: string; updated_at?: string })[];
  submissions: { employee_id: string }[];
  holidays: string[];
  confirmation: { confirmed_at: string; confirmed_by_name: string } | null;
  updated_at: string | null;
  candidates: { work_date: string; hours: number }[];
};
export default function ShiftManager() {
  const { allowedTab } = useSystemView(),
    mine = allowedTab("mine"),
    team = allowedTab("team", false);
  const [tab, setTab] = useUrlTab<"mine" | "team">(
    mine ? "mine" : "team",
    (key) => (key === "mine" && mine) || (key === "team" && team),
  );
  return (
    <main>
      <SystemBreadcrumb items={[{ label: "シフト" }]} />
      <h1>シフト</h1>
      <SystemTabs actions={<SystemViewButton tabKey={tab} />}>
        {mine && (
          <button
            role="tab"
            aria-selected={tab === "mine"}
            onClick={() => setTab("mine")}
          >
            自分のシフト
          </button>
        )}
        {team && (
          <button
            role="tab"
            aria-selected={tab === "team"}
            onClick={() => setTab("team")}
          >
            みんなのシフト
          </button>
        )}
      </SystemTabs>
      {tab === "mine" && mine ? <MyShift /> : team ? <TeamShift /> : null}
    </main>
  );
}
export function TeamShift() {
  const pending = useRef(false);
  const [showAll, setShowAll] = useState(false);
  const [{ current, next }] = useState(shiftMonths),
    [month, setMonth] = useState(next),
    [data, setData] = useState<TeamData | null>(null),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [person, setPerson] = useState<ShiftEmployee | null>(null),
    [draft, setDraft] = useState<ShiftDay[]>([]),
    [confirm, setConfirm] = useState<"confirm" | "remind" | null>(null),
    [overlay, setOverlay] = useState<LineSendState | null>(null),
    [result, setResult] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    void fetch("/api/system/shift/team?month=" + month, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [month, revision]);
  async function action(
    kind: string,
    body: { work_date?: string; employee_id?: string; rows?: ShiftDay[] } = {},
  ) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const previous = data;
    if (kind === "holiday" && data && body.work_date) {
      const date = body.work_date;
      setData({
        ...data,
        holidays: data.holidays.includes(date)
          ? data.holidays.filter((day) => day !== date)
          : [...data.holidays, date],
      });
    }
    if (kind === "confirm" || kind === "remind") {
      setConfirm(null);
      setOverlay({
        phase: "sending",
        count: kind === "confirm" ? data!.people.length : missing.length,
      });
    }
    try {
      const r = await fetch("/api/system/shift/team/" + kind, {
        method: kind === "person" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, ...body }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "保存できませんでした。");
      setPerson(null);
      setConfirm(null);
      setRevision((n) => n + 1);
      if (kind === "confirm" || kind === "remind") {
        setOverlay({ phase: "done", sent: d.sent, failed: d.failed });
        setResult(
          `送信 ${d.sent}人・失敗 ${d.failed}人・公式LINE未接続 ${d.unlinked}人`,
        );
        if (!d.failed) setTimeout(() => setOverlay(null), 1500);
      }
    } catch (e) {
      if (kind === "holiday") setData(previous);
      setOverlay(null);
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const missing =
    data?.people.filter(
      (p) => !data.submissions.some((s) => s.employee_id === p.employee_id),
    ) || [];
  const source = data?.confirmation ? data.confirmed : data?.wish || [];
  const updatedAt = [...(data?.wish || []), ...(data?.confirmed || [])]
    .map((row) => row.updated_at)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
  const groups = [
    ...new Set(data?.people.map((p) => p.current_team || "所属なし") || []),
  ];
  const openPerson = (employee: ShiftEmployee) => {
    if (busy || !data) return;
    setPerson(employee);
    setDraft(
      data.days.map((work_date) => ({
        work_date,
        start_time:
          source
            .find(
              (row) =>
                row.employee_id === employee.employee_id &&
                row.work_date === work_date,
            )
            ?.start_time?.slice(0, 5) || null,
      })),
    );
  };
  return (
    <section style={{ minHeight: 560 }}>
      <select
        aria-label="対象の月"
        value={month}
        disabled={busy}
        onChange={(e) => {
          setMonth(e.target.value);
          setData(null);
          setShowAll(false);
        }}
      >
        {[next, current].map((m) => (
          <option key={m} value={m}>
            {Number(m.slice(5))}月
          </option>
        ))}
      </select>
      <div style={{ minHeight: 32 }}>
        {updatedAt && (
          <UpdatedStamp
            label=""
            date={updatedAt}
            showSeconds
            onRefresh={() => setRevision((n) => n + 1)}
            busy={busy}
            refreshLabel="シフトを更新する"
          />
        )}
      </div>
      <ResultMessage>{error}</ResultMessage>
      <p role="status">{result}</p>
      {!data ? (
        <div className={formStyles.shiftLoading} role="status">
          読み込み中です…
        </div>
      ) : (
        <>
          <p>
            提出 {data.people.length - missing.length}/{data.people.length}
            人　未提出 {missing.length}人
          </p>
          <p className={formStyles.shiftMissing}>
            {missing.map((p) => p.name).join("・") || "未提出の人はいません"}
          </p>
          <ActionButton
            disabled={busy || !missing.length}
            onClick={() => setConfirm("remind")}
          >
            未提出の人に公式LINEで知らせる
          </ActionButton>
          <div className="garden-shift-table">
            <table
              aria-label="みんなのシフト"
              style={{ width: 160 + data.days.length * 56 }}
            >
              <colgroup>
                <col style={{ width: 160 }} />
                {data.days.map((date) => (
                  <col key={date} style={{ width: 56 }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">氏名</th>
                  {data.days.map((date) => (
                    <th
                      scope="col"
                      key={date}
                      className={
                        data.holidays.includes(date)
                          ? "garden-shift-closed"
                          : weekend(date)
                            ? "garden-shift-weekend"
                            : undefined
                      }
                    >
                      {Number(date.slice(8))}
                      <br />
                      {data.holidays.includes(date)
                        ? "定休"
                        : shiftDate(date).slice(-2, -1)}
                    </th>
                  ))}
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group}>
                  <tr className="garden-shift-group">
                    <th scope="rowgroup">{group}</th>
                    <td colSpan={data.days.length} />
                  </tr>
                  {data.people
                    .filter((p) => (p.current_team || "所属なし") === group)
                    .map((employee) => (
                      <tr
                        key={employee.employee_id}
                        onClick={() => openPerson(employee)}
                      >
                        <th scope="row">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={(event) => {
                              event.stopPropagation();
                              openPerson(employee);
                            }}
                          >
                            {employee.name}
                          </button>
                        </th>
                        {data.days.map((date) => {
                          const start = data.holidays.includes(date)
                            ? null
                            : source.find(
                                (row) =>
                                  row.employee_id === employee.employee_id &&
                                  row.work_date === date,
                              )?.start_time;
                          return (
                            <td
                              key={date}
                              className={
                                data.holidays.includes(date)
                                  ? "garden-shift-closed"
                                  : undefined
                              }
                            >
                              <span
                                className={
                                  !start ? "garden-shift-rest" : undefined
                                }
                              >
                                {start?.slice(0, 5) || "休"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              ))}
              <tfoot>
                <tr>
                  <th scope="row">合計時間</th>
                  {data.days.map((date) => (
                    <td
                      key={date}
                      className={
                        data.holidays.includes(date)
                          ? "garden-shift-closed"
                          : undefined
                      }
                    >
                      {data.holidays.includes(date)
                        ? 0
                        : source
                            .filter(
                              (row) =>
                                row.work_date === date &&
                                data.people.some(
                                  (p) => p.employee_id === row.employee_id,
                                ),
                            )
                            .reduce(
                              (total, row) => total + hours(row.start_time),
                              0,
                            )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <h3>定休日の候補（合計時間が少ない順）</h3>
          <div className={formStyles.shiftCandidates}>
            {[...data.candidates]
              .sort(
                (a, b) =>
                  a.hours - b.hours || a.work_date.localeCompare(b.work_date),
              )
              .slice(0, showAll ? undefined : 10)
              .map((candidate) => (
                <button
                  type="button"
                  key={candidate.work_date}
                  disabled={busy}
                  aria-pressed={data.holidays.includes(candidate.work_date)}
                  onClick={() =>
                    void action("holiday", { work_date: candidate.work_date })
                  }
                >
                  {shiftDate(candidate.work_date)} {candidate.hours}時間
                  {data.holidays.includes(candidate.work_date) ? " 定休日" : ""}
                </button>
              ))}
            {!showAll && data.candidates.length > 10 && (
              <ActionButton onClick={() => setShowAll(true)}>
                すべての日を表示
              </ActionButton>
            )}
          </div>
          <SubmitButton busy={busy} onClick={() => setConfirm("confirm")}>
            {data.confirmation ? "確定し直す" : "この月のシフトを確定する"}
          </SubmitButton>
          {data.confirmation && (
            <p>
              確定：{stamp(data.confirmation.confirmed_at)}{" "}
              {data.confirmation.confirmed_by_name}
            </p>
          )}
        </>
      )}
      {person && data && (
        <Modal
          size="lg"
          title={`${person.name}さんのシフト（${Number(month.slice(5))}月）`}
          onClose={() => {
            if (!busy) setPerson(null);
          }}
          actions={
            <SubmitButton
              busy={busy}
              onClick={() =>
                void action("person", {
                  employee_id: person.employee_id,
                  rows: draft,
                })
              }
            >
              保存する
            </SubmitButton>
          }
        >
          <ShiftDays
            rows={draft}
            onChange={setDraft}
            disabled={busy}
            holidays={data.holidays}
          />
        </Modal>
      )}
      {confirm && (
        <Modal
          title={
            confirm === "confirm"
              ? "シフトを確定しますか"
              : "未提出の人に知らせますか"
          }
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
          actions={
            <SubmitButton busy={busy} onClick={() => void action(confirm)}>
              {confirm === "confirm" ? "確定する" : "送信する"}
            </SubmitButton>
          }
        >
          {confirm === "confirm" ? (
            <>
              <p>
                定休日以外の希望をそのまま確定シフトにします。確定すると本人の公式LINEに知らせます。
              </p>
              {data?.confirmation && (
                <p>
                  希望から作り直すため、小窓で変更した確定シフトは消えます。
                </p>
              )}
            </>
          ) : (
            <>
              <p>{missing.map((p) => p.name).join("・")}</p>
              <p>
                公式LINEとつながっている人に、提出のお願いと締切を送信します。
              </p>
            </>
          )}
        </Modal>
      )}
      <LineSendOverlay state={overlay} onClose={() => setOverlay(null)} />
    </section>
  );
}
