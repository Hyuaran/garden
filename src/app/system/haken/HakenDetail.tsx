"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import RowActionButton from "@/app/system/_components/RowActionButton/RowActionButton";
import {
  ActionButton,
  FieldLabel,
  formStyles,
  RadioGroup,
} from "@/app/system/forms/_components/form-kit";
import {
  DEFAULT_FIELDS,
  DOCUMENT_LABELS,
  PARTY_FIELDS,
  type HakenData,
  type HakenWorker,
} from "@/lib/haken/types";
import { workerDates } from "@/lib/haken/ledger";
import { todayJst } from "@/lib/haken/rules";
import IssueButtons from "./IssueButtons";
import styles from "./haken.module.css";

type Draft = Record<string, string | boolean | null>;
export async function saveHaken(kind: string, value: unknown) {
  const response = await fetch("/api/system/haken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, value }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <FieldLabel label={label}>{children}</FieldLabel>;
}
export default function HakenDetail({
  initialData,
  kind,
  id,
  canWrite,
}: {
  initialData: HakenData;
  kind: "ledger" | "party" | "office";
  id: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const worker = data.workers.find((w) => w.id === id);
  const sourceContract = data.contracts.find(
    (c) => c.id === worker?.contract_id,
  );
  const party = data.parties.find((p) => p.id === id);
  const office = data.offices.find((o) => o.id === id);
  const [draft, setDraft] = useState<Draft>(
    () =>
      ({
        ...(kind === "party" ? party : kind === "office" ? office : worker),
      }) as Draft,
  );
  const [contract, setContract] = useState<Draft>(
    () => ({ ...sourceContract }) as Draft,
  );
  const [defaults, setDefaults] = useState<Record<string, string>>(
    party?.issue_defaults ?? {},
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [issueStart, setIssueStart] = useState("");
  const [issueEnd, setIssueEnd] = useState("");
  const [event, setEvent] = useState({
    on_date: todayJst(),
    kind: "training",
    content: "",
    handler: "",
    result: "",
    party_contact: "",
  });
  const [docType, setDocType] = useState("individual");
  const [docDate, setDocDate] = useState(todayJst());
  const [file, setFile] = useState<File | null>(null);
  const set = (key: string, value: string | boolean | null) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setC = (key: string, value: string | boolean | null) =>
    setContract((c) => ({ ...c, [key]: value }));
  const input = (
    key: string,
    label: string,
    source = draft,
    change = set,
    type = "text",
  ) => (
    <Field key={key} label={label}>
      <input
        type={type}
        value={String(source[key] ?? "")}
        onChange={(e) => change(key, e.target.value)}
        required={["name", "period_start"].includes(key)}
      />
    </Field>
  );
  const bool = (
    key: string,
    label: string,
    source = draft,
    change = set,
    yes = "はい",
    no = "いいえ",
  ) => (
    <Field key={key} label={label}>
      <RadioGroup
        name={key}
        label={label}
        options={[yes, no]}
        value={source[key] ? yes : no}
        onChange={(value) => change(key, value === yes)}
      />
    </Field>
  );
  const select = (
    key: string,
    label: string,
    choices: { value: string; label: string }[],
    source = draft,
    change = set,
  ) => (
    <Field label={label}>
      <select
        value={String(source[key] ?? "")}
        onChange={(e) => change(key, e.target.value)}
      >
        <option value="">選んでください</option>
        {choices.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
  const refresh = async () => {
    const response = await fetch("/api/system/haken", { cache: "no-store" });
    if (!response.ok) throw new Error("読み込めませんでした。");
    setData(await response.json());
  };
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "保存できませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }
  const title =
    kind === "ledger"
      ? String(draft.name || "受け入れた人を追加")
      : kind === "party"
        ? String(draft.name || "派遣会社を追加")
        : String(draft.name || "受入事業所を追加");
  const dates = worker && sourceContract ? workerDates(data, worker) : null;
  return (
    <main className={styles.page}>
      <SystemBreadcrumb
        items={[{ label: "派遣管理", href: "/system/haken" }, { label: title }]}
      />
      <h1>{title}</h1>
      {message && (
        <p
          role={message === "保存しました。" ? "status" : "alert"}
          className={message === "保存しました。" ? undefined : styles.error}
        >
          {message}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const value =
              kind === "ledger"
                ? { contract, worker: draft }
                : kind === "party"
                  ? {
                      ...draft,
                      invoice_delivery: draft.invoice_delivery || "mail",
                      issue_defaults: defaults,
                    }
                  : draft;
            const saved = await saveHaken(kind, value);
            await refresh();
            router.push(
              `/system/haken/${kind === "ledger" ? "ukeire" : kind === "party" ? "parties" : "offices"}/${saved.id}`,
            );
            router.refresh();
            setMessage("保存しました。");
          });
        }}
      >
        <fieldset
          disabled={!canWrite || busy}
          style={{ border: 0, padding: 0 }}
        >
          {kind === "party" && (
            <>
              <div className={styles.grid}>
                {PARTY_FIELDS.map(([key, label]) =>
                  input(
                    key,
                    label,
                    draft,
                    set,
                    key.endsWith("_on") ? "date" : "text",
                  ),
                )}
                {select("invoice_delivery", "請求書の届き方", [
                  { value: "mail", label: "メールで届く" },
                  { value: "portal", label: "自分で見に行く" },
                ])}
              </div>
              <fieldset className={styles.section}>
                <legend>発行書類の初期値</legend>
                <div className={styles.grid}>
                  <Field label="受入事業所">
                    <select
                      value={defaults.office_id ?? ""}
                      onChange={(e) =>
                        setDefaults((d) => ({
                          ...d,
                          office_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">選んでください</option>
                      {data.offices.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {DEFAULT_FIELDS.map(([key, label]) => (
                    <Field key={key} label={label}>
                      <textarea
                        value={defaults[key] ?? ""}
                        onChange={(e) =>
                          setDefaults((d) => ({ ...d, [key]: e.target.value }))
                        }
                      />
                    </Field>
                  ))}
                </div>
                <p>派遣期間は入社予定日と終了日から入ります。</p>
              </fieldset>
            </>
          )}
          {kind === "office" && (
            <div className={styles.grid}>
              {select(
                "company_id",
                "法人",
                data.companies.map((c) => ({
                  value: c.company_id,
                  label: c.company_name,
                })),
              )}
              {[
                ["name", "事業所名"],
                ["address", "所在地"],
                ["training_note", "教育訓練の有無と内容"],
                ["cafeteria_note", "給食施設"],
                ["rest_room_note", "休憩室の有無と内容"],
                ["changing_room_note", "更衣室"],
              ].map(([key, label]) => input(key, label))}
            </div>
          )}
          {kind === "ledger" && (
            <>
              <fieldset className={styles.section}>
                <legend>派遣労働者（派遣元からの通知で入力）</legend>
                <div className={styles.grid}>
                  <Field label="従業員（名簿に無い人は空のまま）">
                    <select
                      value={String(draft.employee_id ?? "")}
                      onChange={(e) => {
                        const employee = data.employees.find(
                          (employee) => employee.employee_id === e.target.value,
                        );
                        setDraft((d) => ({
                          ...d,
                          employee_id: e.target.value || null,
                          ...(employee ? { name: employee.name } : {}),
                        }));
                        if (employee?.haken_party_id)
                          setC("party_id", employee.haken_party_id);
                      }}
                    >
                      <option value="">名簿と紐付けない</option>
                      {data.employees.map((e) => (
                        <option key={e.employee_id} value={e.employee_id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {input("name", "氏名")}
                  {select("gender", "性別", [
                    { value: "male", label: "男" },
                    { value: "female", label: "女" },
                  ])}
                  {bool(
                    "is_indefinite",
                    "雇用期間",
                    draft,
                    set,
                    "無期",
                    "有期",
                  )}
                  {bool("is_over_60", "60歳以上")}
                  {bool(
                    "is_agreement",
                    "協定対象",
                    draft,
                    set,
                    "対象",
                    "対象外",
                  )}
                  {input(
                    "party_notice_on",
                    "派遣元からの通知の受領日",
                    draft,
                    set,
                    "date",
                  )}
                  {bool(
                    "health_insurance",
                    "健康保険",
                    draft,
                    set,
                    "あり",
                    "なし",
                  )}
                  {bool("pension", "厚生年金", draft, set, "あり", "なし")}
                  {bool(
                    "employment_insurance",
                    "雇用保険",
                    draft,
                    set,
                    "あり",
                    "なし",
                  )}
                  {input("insurance_reason", "なしの理由")}
                </div>
              </fieldset>
              <fieldset className={styles.section}>
                <legend>派遣元</legend>
                {select(
                  "party_id",
                  "派遣会社",
                  data.parties.map((p) => ({ value: p.id, label: p.name })),
                  contract,
                  setC,
                )}
                {data.parties
                  .filter((p) => p.id === contract.party_id)
                  .map((p) => (
                    <p key={p.id}>
                      {[
                        p.address,
                        p.permit_no && `許可番号 ${p.permit_no}`,
                        p.manager_name && `責任者 ${p.manager_name}`,
                      ]
                        .filter(Boolean)
                        .join(" ／ ")}
                    </p>
                  ))}
              </fieldset>
              <fieldset className={styles.section}>
                <legend>個別契約</legend>
                <div className={styles.grid}>
                  {select(
                    "office_id",
                    "受入事業所",
                    data.offices.map((o) => ({ value: o.id, label: o.name })),
                    contract,
                    setC,
                  )}
                  {[
                    ["org_unit", "組織単位"],
                    ["work_content", "業務の種類"],
                    ["responsibility", "責任の程度"],
                    ["period_start", "開始日"],
                    ["period_end", "終了日"],
                    ["work_days", "就業日"],
                    ["work_hours", "始業・終業"],
                    ["break_note", "休憩"],
                    ["supervisor_name", "派遣先責任者"],
                    ["commander_name", "指揮命令者"],
                    ["complaint_owner_name", "苦情の担当"],
                    ["no_limit_reason", "期間制限なしの理由"],
                    ["notified_conflict_on", "通知した抵触日"],
                  ].map(([key, label]) =>
                    input(
                      key,
                      label,
                      contract,
                      setC,
                      key.startsWith("period_") || key.endsWith("_on")
                        ? "date"
                        : "text",
                    ),
                  )}
                  {input("end_reason", "終了の理由")}
                  {bool("is_introduction", "紹介予定派遣", contract, setC)}
                </div>
              </fieldset>
            </>
          )}
          <div className={styles.actions}>
            <button
              type="submit"
              className={formStyles.primary}
              disabled={!canWrite || busy}
            >
              保存する
            </button>
          </div>
        </fieldset>
      </form>
      {kind === "party" && id !== "new" && (
        <fieldset className={styles.section}>
          <legend>書類を発行する</legend>
          <div className={styles.grid}>
            <Field label="派遣期間の開始日">
              <input
                type="date"
                value={issueStart}
                onChange={(e) => setIssueStart(e.target.value)}
              />
            </Field>
            <Field label="派遣期間の終了日">
              <input
                type="date"
                value={issueEnd}
                onChange={(e) => setIssueEnd(e.target.value)}
              />
            </Field>
          </div>
          {canWrite && (
            <IssueButtons
              data={data}
              partyId={id}
              start={issueStart}
              end={issueEnd}
              onError={setMessage}
            />
          )}
        </fieldset>
      )}
      {kind === "ledger" && dates && (
        <>
          <fieldset className={styles.section}>
            <legend>抵触日（自動）</legend>
            <p>
              事業所単位 {dates.office}（通知した日{" "}
              {sourceContract?.notified_conflict_on ?? "未通知"}）／個人単位{" "}
              {dates.individual ?? "対象外"}
            </p>
            <p>
              意見聴取の期限 {dates.hearing} ／ 保存期限{" "}
              {dates.retention ?? "派遣終了日から3年間"}
            </p>
            {dates.mismatch && <p role="alert">通知した抵触日と違います</p>}
          </fieldset>
          <fieldset className={styles.section}>
            <legend>書類</legend>
            {canWrite && (
              <div className={styles.tools}>
                <select
                  aria-label="書類の種類"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  {Object.entries(DOCUMENT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="書類の日付"
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                />
                <input
                  aria-label="ファイルを選択"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <ActionButton
                  disabled={busy || !file}
                  onClick={() =>
                    void run(async () => {
                      const form = new FormData();
                      form.set("file", file!);
                      form.set("contract_id", worker!.contract_id);
                      form.set("doc_type", docType);
                      form.set("issued_on", docDate);
                      const response = await fetch(
                        "/api/system/haken/documents",
                        { method: "POST", body: form },
                      );
                      if (!response.ok)
                        throw new Error((await response.json()).error);
                      await refresh();
                      setFile(null);
                    })
                  }
                >
                  追加する
                </ActionButton>
              </div>
            )}
            {data.documents
              .filter((d) => d.contract_id === worker?.contract_id)
              .map((d) => (
                <p key={d.id}>
                  {DOCUMENT_LABELS[d.doc_type]} {d.issued_on}{" "}
                  {d.drive_url ? (
                    <a href={d.drive_url} target="_blank" rel="noreferrer">
                      開く
                    </a>
                  ) : (
                    "保存できませんでした"
                  )}
                  {canWrite && (
                    <RowActionButton
                      kind="delete"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await saveHaken("delete-document", { id: d.id });
                          await refresh();
                        })
                      }
                    />
                  )}
                </p>
              ))}
          </fieldset>
          <fieldset className={styles.section}>
            <legend>教育訓練・苦情</legend>
            {canWrite && (
              <>
                <div className={styles.grid}>
                  <Field label="日付">
                    <input
                      type="date"
                      value={event.on_date}
                      onChange={(e) =>
                        setEvent((v) => ({ ...v, on_date: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="区分">
                    <select
                      value={event.kind}
                      onChange={(e) =>
                        setEvent((v) => ({ ...v, kind: e.target.value }))
                      }
                    >
                      <option value="training">教育訓練</option>
                      <option value="complaint">苦情</option>
                    </select>
                  </Field>
                  {[
                    ["content", "内容"],
                    ["handler", "対応者"],
                    ["result", "結果"],
                    ["party_contact", "派遣元への連絡"],
                  ].map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        value={event[key as keyof typeof event]}
                        onChange={(e) =>
                          setEvent((v) => ({ ...v, [key]: e.target.value }))
                        }
                      />
                    </Field>
                  ))}
                </div>
                <ActionButton
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await saveHaken("event", { ...event, worker_id: id });
                      await refresh();
                    })
                  }
                >
                  追加する
                </ActionButton>
              </>
            )}
            {data.events
              .filter((e) => e.worker_id === id)
              .map((e) => (
                <p key={e.id}>
                  {e.on_date} {e.kind === "training" ? "教育訓練" : "苦情"}{" "}
                  {e.content} ／ {e.handler} ／ {e.result} ／ {e.party_contact}
                </p>
              ))}
          </fieldset>
          <div className={styles.actions}>
            <a
              className={formStyles.actionButton}
              href={`/api/system/haken/excel?id=${id}`}
            >
              台帳を Excel で出力する
            </a>
            {canWrite && (
              <ActionButton
                disabled={busy}
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  void run(async () => {
                    await saveHaken("delete-worker", { id });
                    router.push("/system/haken");
                  });
                }}
              >
                {confirmDelete ? "本当に削除する" : "台帳を削除する"}
              </ActionButton>
            )}
          </div>
        </>
      )}
    </main>
  );
}
