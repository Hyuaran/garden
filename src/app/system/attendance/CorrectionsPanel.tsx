"use client";
import { useEffect, useRef, useState } from "react";
import DataTable, {
  type DataColumn,
} from "@/app/system/_components/DataTable/DataTable";
import Modal from "@/app/system/_components/Modal/Modal";
import UpdatedStamp from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import {
  ActionButton,
  FieldLabel,
  RadioGroup,
  TextField,
  TextArea,
  SelectField,
  SubmitButton,
} from "@/app/system/forms/_components/form-kit";
import {
  PUNCH_LABELS,
  type AttendancePunch,
  type PunchType,
} from "../_lib/attendance";
import styles from "./corrections.module.css";

type Correction = {
  can_decide?: boolean;
  id: number;
  employee_id: string;
  work_date: string;
  action: string;
  punch_type: PunchType;
  requested_time: string | null;
  reason: string;
  status: string;
  created_at: string;
  decided_comment: string | null;
  kot_fix_needed: boolean;
  kot_fixed_at: string | null;
  root_employees?: { name: string };
};
const states: Record<string, string> = {
  pending: "未承認",
  approved: "承認済み",
  rejected: "却下",
  canceled: "取消",
};
const actions: Record<string, string> = {
  add: "追加",
  change: "変更",
  delete: "削除",
};
const stamp = (value: string) =>
  new Date(value).toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" });
function description(row: Correction) {
  return (
    PUNCH_LABELS[row.punch_type] +
    "を" +
    actions[row.action] +
    (row.requested_time ? " " + stamp(row.requested_time) : "")
  );
}
async function read(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "処理できませんでした。");
  return result;
}
export default function CorrectionsPanel({
  approve = false,
}: {
  approve?: boolean;
}) {
  const [rows, setRows] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }),
  );
  const [action, setAction] = useState("add");
  const [type, setType] = useState<PunchType>("clock_out");
  const [time, setTime] = useState("21:00");
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [punches, setPunches] = useState<AttendancePunch[]>([]);
  const [selected, setSelected] = useState<Correction | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/system/attendance/corrections?approve=" + approve)
      .then(read)
      .then((data) => {
        if (active) {
          setRows(data.rows);
          setError("");
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [approve, revision]);
  useEffect(() => {
    if (approve && !selected) return;
    let active = true;
    const query = new URLSearchParams({ date: selected?.work_date || date });
    if (approve && selected) query.set("employee_id", selected.employee_id);
    void fetch("/api/system/attendance/day?" + query)
      .then(read)
      .then((data) => {
        if (active) setPunches(data.punches);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [date, approve, selected?.id, selected?.work_date, selected?.employee_id]);
  async function submit() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await read(
        await fetch("/api/system/attendance/corrections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            work_date: date,
            action,
            punch_type: type,
            time,
            reason,
            target_punch_id: target ? Number(target) : null,
          }),
        }),
      );
      setReason("");
      setError("");
      setRevision((value) => value + 1);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }
  async function decide(row: Correction, decision: string) {
    if (pending.current) return;
    if (decision === "rejected" && !comment.trim()) {
      setError("却下の理由を入力してください。");
      return;
    }
    pending.current = true;
    setBusy(true);
    const previous = rows;
    setRows(rows.filter((item) => item.id !== row.id));
    setSelected(null);
    try {
      await read(
        await fetch("/api/system/attendance/corrections", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: row.id, decision, comment }),
        }),
      );
      setRevision((value) => value + 1);
      setError("");
    } catch (error) {
      setRows(previous);
      setError((error as Error).message);
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }
  const columns: DataColumn<Correction>[] = [
    {
      id: "created",
      label: "申請日時",
      type: "date",
      value: (row) => row.created_at,
      render: (row) => stamp(row.created_at),
    },
    ...(approve
      ? [
          {
            id: "name",
            label: "氏名",
            type: "text" as const,
            value: (row: Correction) => row.root_employees?.name || "",
          },
        ]
      : []),
    { id: "date", label: "日付", type: "text", value: (row) => row.work_date },
    { id: "content", label: "内容", type: "text", value: description },
    {
      id: "reason",
      label: "理由",
      type: "text",
      value: (row) => row.reason,
      wrap: true,
    },
    {
      id: "status",
      label: "状態",
      type: "text",
      value: (row) => states[row.status],
    },
    {
      id: "comment",
      label: "却下の理由",
      type: "text",
      value: (row) => row.decided_comment || "",
    },
  ];
  return (
    <section className={styles.panel}>
      {error && <p role="alert">{error}</p>}
      {!approve && (
        <div className={styles.form}>
          <FieldLabel label="日付">
            <TextField
              type="date"
              aria-label="日付"
              value={date}
              max={new Date().toLocaleDateString("sv-SE", {
                timeZone: "Asia/Tokyo",
              })}
              onChange={(event) => {
                setDate(event.target.value);
                setTarget("");
              }}
            />
          </FieldLabel>
          <RadioGroup
            name="correction-action"
            label="修正の内容"
            options={["打刻を追加する", "時刻を変更する", "打刻を削除する"]}
            value={
              {
                add: "打刻を追加する",
                change: "時刻を変更する",
                delete: "打刻を削除する",
              }[action]!
            }
            onChange={(value) =>
              setAction(
                value === "打刻を追加する"
                  ? "add"
                  : value === "時刻を変更する"
                    ? "change"
                    : "delete",
              )
            }
          />
          <FieldLabel label="打刻">
            {action === "add" ? (
              <SelectField
                aria-label="打刻"
                value={type}
                onChange={(event) => setType(event.target.value as PunchType)}
              >
                {Object.entries(PUNCH_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </SelectField>
            ) : (
              <SelectField
                aria-label="その日の打刻"
                value={target}
                onChange={(event) => {
                  setTarget(event.target.value);
                  const punch = punches.find(
                    (row) => row.id === Number(event.target.value),
                  );
                  if (punch) setType(punch.punch_type);
                }}
              >
                {punches.map((row) => (
                  <option key={row.id} value={row.id}>
                    {PUNCH_LABELS[row.punch_type]} {stamp(row.punched_at)}
                  </option>
                ))}
              </SelectField>
            )}
          </FieldLabel>
          {action !== "delete" && (
            <FieldLabel label="時刻">
              <TextField
                aria-label="時刻"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </FieldLabel>
          )}
          <FieldLabel label="理由" required>
            <TextArea
              aria-label="理由"
              required
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FieldLabel>
          <SubmitButton
            busy={busy}
            disabled={!reason.trim() || (action !== "add" && !target)}
            onClick={() => void submit()}
          >
            申請する
          </SubmitButton>
        </div>
      )}
      {approve && (
        <>
          <h3>KING OF TIME の画面で修正する分</h3>
          {rows
            .filter((row) => row.kot_fix_needed && !row.kot_fixed_at)
            .map((row) => (
              <p key={row.id}>
                {row.root_employees?.name} {row.work_date} {description(row)}　
                <ActionButton
                  disabled={busy}
                  onClick={() => void decide(row, "fixed")}
                >
                  修正済みにする
                </ActionButton>
              </p>
            ))}
          <p>
            この修正は KING OF TIME には自動で反映されません。KING OF TIME
            の画面で修正してください。
          </p>
        </>
      )}
      <h3>
        {approve
          ? `未承認 ${rows.filter((row) => row.status === "pending").length}件`
          : "自分の申請"}
      </h3>
      <UpdatedStamp
        label=""
        date={rows[0]?.created_at || null}
        showSeconds
        onRefresh={() => setRevision((value) => value + 1)}
        busy={busy}
      />
      <DataTable
        rows={approve ? rows.filter((row) => row.status === "pending") : rows}
        columns={columns}
        rowKey={(row) => String(row.id)}
        searchText={(row) => row.reason + description(row)}
        defaultSort={{ id: "created", direction: "desc" }}
        loading={loading}
        onRowClick={(row) => {
          setSelected(row);
          setComment("");
        }}
      />
      {selected && (
        <Modal
          title="打刻の修正の確認"
          onClose={() => setSelected(null)}
          actions={
            <>
              {selected.status === "pending" &&
                (approve ? (
                  <>
                    <ActionButton
                      disabled={busy}
                      onClick={() => void decide(selected, "rejected")}
                    >
                      却下する
                    </ActionButton>
                    <SubmitButton
                      busy={busy}
                      disabled={selected.can_decide === false}
                      onClick={() => void decide(selected, "approved")}
                    >
                      承認する
                    </SubmitButton>
                  </>
                ) : (
                  <ActionButton
                    disabled={busy}
                    onClick={() => void decide(selected, "canceled")}
                  >
                    取り消す
                  </ActionButton>
                ))}
            </>
          }
        >
          <p>
            {selected.root_employees?.name} {selected.work_date}
          </p>
          <p>
            その日の打刻：
            {punches
              .map(
                (row) =>
                  `${PUNCH_LABELS[row.punch_type]} ${stamp(row.punched_at)}`,
              )
              .join("、") || "ありません"}
          </p>
          {approve && selected.can_decide === false && (
            <p>自分の申請は承認できません。</p>
          )}
          <p>申請の内容：{description(selected)}</p>
          <p>理由：{selected.reason}</p>
          <p>申請日時：{stamp(selected.created_at)}</p>
          <p>状態：{states[selected.status]}</p>
          {approve && selected.status === "pending" && (
            <FieldLabel label="却下の理由">
              <TextArea
                aria-label="却下の理由"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </FieldLabel>
          )}
          {selected.decided_comment && (
            <p>却下の理由：{selected.decided_comment}</p>
          )}
        </Modal>
      )}
    </section>
  );
}
