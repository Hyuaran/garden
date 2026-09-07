"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildPayrollNoticeMessage,
  normalizePayrollNoticeInput,
  summarizeFlag,
  TEAMS,
  TRAINING_HOURS_LABEL,
  validatePayrollNotice,
  type CommutePerson,
  type PayrollNoticeInput,
  type ReferralPerson,
  type TrainingPerson,
} from "./_lib/payroll-notice";
import styles from "./payroll-notice.module.css";

type StatusState =
  | { loading: true }
  | { loading: false; registered: true; accountName: string | null }
  | { loading: false; registered: false; reason: string };

type NoticeHistory = {
  id: string;
  submitted_at: string;
  submitter_name: string;
  team: string;
  commute_flag: string;
  commute_people: CommutePerson[];
  training_flag: string;
  training_people: TrainingPerson[];
  referral_flag: string;
  referral_people: ReferralPerson[];
  chatwork_message: string;
  chatwork_sent_at: string | null;
  chatwork_error: string | null;
};

const emptyInput: PayrollNoticeInput = {
  team: "",
  commuteFlag: "",
  commutePeople: [],
  trainingFlag: "",
  trainingPeople: [],
  referralFlag: "",
  referralPeople: [],
  otherNotes: "",
};

function compactDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function blankCommute(): CommutePerson {
  return { name: "", station: "" };
}

function blankTraining(): TrainingPerson {
  return { name: "" };
}

function blankReferral(): ReferralPerson {
  return { name: "", referrer: "" };
}

export default function PayrollNoticeClient({
  submitterName,
  canViewHistory,
}: {
  submitterName: string;
  canViewHistory: boolean;
}) {
  const [input, setInput] = useState<PayrollNoticeInput>(emptyInput);
  const [status, setStatus] = useState<StatusState>({ loading: true });
  const [errors, setErrors] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<NoticeHistory[]>([]);
  const [historyBody, setHistoryBody] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setStatus({ loading: true });
    const response = await fetch("/api/system/payroll-notice/status", { cache: "no-store" });
    const body = await response.json();
    if (body.registered) {
      setStatus({ loading: false, registered: true, accountName: body.accountName ?? null });
    } else {
      setStatus({ loading: false, registered: false, reason: String(body.reason ?? "名簿に登録なし") });
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!canViewHistory) return;
    const response = await fetch("/api/system/payroll-notice", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    setHistory(Array.isArray(body.notices) ? body.notices : []);
  }, [canViewHistory]);

  useEffect(() => {
    void loadStatus();
    void loadHistory();
  }, [loadHistory, loadStatus]);

  const preview = useMemo(() => buildPayrollNoticeMessage({
    ...input,
    submitterName,
    submittedAt: new Date(),
  }), [input, submitterName]);

  function update(next: Partial<PayrollNoticeInput>) {
    setInput((current) => normalizePayrollNoticeInput({ ...current, ...next }));
    setErrors([]);
    setMessage(null);
  }

  function setFlag(key: "commuteFlag" | "trainingFlag" | "referralFlag", value: string) {
    if (key === "commuteFlag") {
      update({ commuteFlag: value, commutePeople: value === "いる" ? (input.commutePeople.length ? input.commutePeople : [blankCommute()]) : [] });
    } else if (key === "trainingFlag") {
      update({ trainingFlag: value, trainingPeople: value === "いる" ? (input.trainingPeople.length ? input.trainingPeople : [blankTraining()]) : [] });
    } else {
      update({ referralFlag: value, referralPeople: value === "いる" ? (input.referralPeople.length ? input.referralPeople : [blankReferral()]) : [] });
    }
  }

  async function submit() {
    const validation = validatePayrollNotice(input);
    if (validation.length > 0) {
      setErrors(validation);
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/system/payroll-notice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(String(body.error ?? "送信できませんでした"));
        return;
      }
      setMessage(`送信しました。【確認】チーム給与計算 に投稿済み（${compactDate(body.notice.submittedAt)}・${body.notice.submitterName}）`);
      setInput(emptyInput);
      setPreviewOpen(false);
      await loadHistory();
    } finally {
      setSending(false);
    }
  }

  const registered = !status.loading && status.registered;

  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>System / 給与計算連絡</p>
      <h1>給与計算に関する連絡</h1>
      <p className={styles.lead}>営業部のみなさま、今月も業務お疲れ様でした！ 入力して送信すると、Chatwork に投稿されます。</p>
      <p className={styles.sender}>送信者：{submitterName}{registered && status.accountName ? `（Chatwork：${status.accountName} で投稿します）` : ""}</p>
    </header>

    {!status.loading && !status.registered && (
      <div className={styles.warning} role="alert">
        Chatwork の API トークンが従業員名簿に登録されていません。事務へ連絡してください。
      </div>
    )}

    {errors.length > 0 && <div className={styles.errorList} role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
    {message && <div className={styles.message}>{message}</div>}

    <section className={`${styles.panel} ${styles.teamPanel}`}>
      <h2>対象チーム <span>必須</span></h2>
      <div className={styles.segmented}>
        {TEAMS.map((team) => <label key={team}><input type="radio" name="team" checked={input.team === team} onChange={() => update({ team })} /><span>{team}</span></label>)}
      </div>
    </section>

    <section className={styles.panel}>
      <h2>交通費変更該当者 <span>必須</span></h2>
      <p className={styles.hint}>参考：<a href="https://9j11u0q829lg.cybozu.com/k/93/" target="_blank" rel="noopener noreferrer">交通費変更申請フォーム／一覧はこちら</a></p>
      <FlagRow name="commuteFlag" value={input.commuteFlag} onChange={(value) => setFlag("commuteFlag", value)} />
      {input.commuteFlag === "いる" && <Rows onAdd={() => update({ commutePeople: [...input.commutePeople, blankCommute()] })} addLabel="該当者を追加">
        {input.commutePeople.map((person, index) => <div className={styles.personRow} key={index}>
          <Field label="該当者名" value={person.name} placeholder="例）山田太郎" onChange={(name) => update({ commutePeople: input.commutePeople.map((row, i) => i === index ? { ...row, name } : row) })} />
          <Field label="通勤最寄り駅" value={person.station} placeholder="例）梅田駅～難波駅" onChange={(station) => update({ commutePeople: input.commutePeople.map((row, i) => i === index ? { ...row, station } : row) })} />
          <button type="button" className={styles.remove} onClick={() => update({ commutePeople: input.commutePeople.filter((_, i) => i !== index) })}>削除</button>
        </div>)}
      </Rows>}
    </section>

    <section className={styles.panel}>
      <h2>研修中社員（{TRAINING_HOURS_LABEL}／時給1,500円 該当者） <span>必須</span></h2>
      <FlagRow name="trainingFlag" value={input.trainingFlag} onChange={(value) => setFlag("trainingFlag", value)} />
      {input.trainingFlag === "いる" && <Rows onAdd={() => update({ trainingPeople: [...input.trainingPeople, blankTraining()] })} addLabel="追加">
        {input.trainingPeople.map((person, index) => <div className={styles.personRowSingle} key={index}>
          <Field label="該当者名" value={person.name} placeholder="例）山田太郎" onChange={(name) => update({ trainingPeople: input.trainingPeople.map((row, i) => i === index ? { name } : row) })} />
          <button type="button" className={styles.remove} onClick={() => update({ trainingPeople: input.trainingPeople.filter((_, i) => i !== index) })}>削除</button>
        </div>)}
      </Rows>}
    </section>

    <section className={styles.panel}>
      <h2>紹介入社である社員 <span>必須</span></h2>
      <FlagRow name="referralFlag" value={input.referralFlag} onChange={(value) => setFlag("referralFlag", value)} />
      {input.referralFlag === "いる" && <Rows onAdd={() => update({ referralPeople: [...input.referralPeople, blankReferral()] })} addLabel="追加">
        {input.referralPeople.map((person, index) => <div className={styles.personRow} key={index}>
          <Field label="該当者名" value={person.name} placeholder="例）山田太郎" onChange={(name) => update({ referralPeople: input.referralPeople.map((row, i) => i === index ? { ...row, name } : row) })} />
          <Field label="紹介者名" value={person.referrer} placeholder="例）田中花子" onChange={(referrer) => update({ referralPeople: input.referralPeople.map((row, i) => i === index ? { ...row, referrer } : row) })} />
          <button type="button" className={styles.remove} onClick={() => update({ referralPeople: input.referralPeople.filter((_, i) => i !== index) })}>削除</button>
        </div>)}
      </Rows>}
    </section>

    <section className={styles.panel}>
      <h2>その他共有事項 <span>必須</span></h2>
      <textarea className={styles.textarea} value={input.otherNotes} onChange={(event) => update({ otherNotes: event.target.value })} placeholder="共有したいことを入力してください" />
    </section>

    <div className={styles.actions}>
      <button type="button" className={styles.secondary} onClick={() => setPreviewOpen((open) => !open)}>プレビュー</button>
      <button type="button" className={styles.primary} disabled={!registered || sending} onClick={() => void submit()}>{sending ? "送信中..." : "Chatwork に送信"}</button>
    </div>
    {previewOpen && <pre className={styles.preview}>{preview}</pre>}

    {canViewHistory && <section className={styles.history}>
      <h2>送信履歴</h2>
      <div className={styles.tableWrap}>
        <table>
          <thead><tr><th>日時</th><th>対象チーム</th><th>送信者</th><th>交通費</th><th>研修</th><th>紹介</th><th>Chatwork</th><th></th></tr></thead>
          <tbody>
            {history.map((item) => <tr key={item.id}>
              <td>{compactDate(item.submitted_at)}</td>
              <td>{item.team}</td>
              <td>{item.submitter_name}</td>
              <td>{summarizeFlag(item.commute_flag, item.commute_people?.length ?? 0)}</td>
              <td>{summarizeFlag(item.training_flag, item.training_people?.length ?? 0)}</td>
              <td>{summarizeFlag(item.referral_flag, item.referral_people?.length ?? 0)}</td>
              <td>{item.chatwork_sent_at ? "投稿済み" : item.chatwork_error ? "未送信" : "処理中"}</td>
              <td><button className={styles.linkButton} type="button" onClick={() => setHistoryBody(item.chatwork_message)}>本文を見る</button></td>
            </tr>)}
            {history.length === 0 && <tr><td colSpan={8}>送信履歴はまだありません。</td></tr>}
          </tbody>
        </table>
      </div>
    </section>}
    {historyBody && <div className={styles.modalBackdrop} onClick={() => setHistoryBody(null)}><div className={styles.modal} onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => setHistoryBody(null)}>閉じる</button><pre>{historyBody}</pre></div></div>}
  </div>;
}

function FlagRow({ name, value, onChange }: { name: string; value: string; onChange: (value: string) => void }) {
  return <div className={styles.radioRow}>
    {["いる", "いない"].map((item) => <label key={item}><input type="radio" name={name} checked={value === item} onChange={() => onChange(item)} /><span>{item}</span></label>)}
  </div>;
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return <label className={styles.field}><span>{label}</span><input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Rows({ children, onAdd, addLabel }: { children: React.ReactNode; onAdd: () => void; addLabel: string }) {
  return <div className={styles.rows}>{children}<button type="button" className={styles.add} onClick={onAdd}>+ {addLabel}</button></div>;
}
