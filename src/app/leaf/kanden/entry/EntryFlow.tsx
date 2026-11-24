import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { StatusBadge, TextField } from "@/app/system/forms/_components/form-kit";
import type { OrderStatus } from "@/lib/leaf-kanden/status";
import type { EntryDraft } from "./entry";
import styles from "./entry.module.css";

const steps = [
  ["ordered_on", "受注", "受注", "受注日"],
  ["specs_on", "諸元待ち", "諸元回収OK", "諸元回収日"],
  ["entered_on", "エントリー待ち", "エントリーOK", "エントリー日"],
  ["application_received_on", "申込書待ち", "申込書受取OK", "申込書受取日"],
  ["mailed_on", "郵送待ち", "郵送OK", "郵送日"],
  ["paid_on", "入金待ち", "入金OK", "入金日"],
  [null, "完了", "完了", ""],
] as const;

export default function EntryFlow({ draft, paidOn, status, progress, specsReady, canEdit, setDraft }: {
  draft: EntryDraft; paidOn: string | null; status: OrderStatus; progress: OrderStatus; specsReady: boolean;
  canEdit: boolean; setDraft: (draft: EntryDraft) => void;
}) {
  const current = steps.findIndex(([, waiting]) => waiting === progress);
  const exception = status === "キャンセル" ? status : status === "保留" || status === "差し戻し" ? "差し戻し" : null;
  return <div className={styles.flow} aria-label="業務ステータス" {...CLARITY_MASK}>
    {steps.map(([key, waiting, done, label], index) => {
      const date = key === "paid_on" ? paidOn : key && draft[key];
      const finished = !!date || (key === "specs_on" && specsReady);
      return <div key={waiting} className={styles.step} data-passed={finished || index < current}
        data-waiting-specs={key === "specs_on"} aria-current={index === current ? "step" : undefined}>
        <strong>{finished ? done : waiting}</strong>
        {key === "paid_on" ? <span>{date ?? "―"}</span> : key &&
          <TextField type="date" aria-label={label} value={date ?? ""} disabled={!canEdit}
            onChange={event => setDraft({ ...draft, [key]: event.target.value || null })} />}
      </div>;
    })}
    {exception && <div className={styles.flowException}><StatusBadge>{exception}</StatusBadge></div>}
  </div>;
}
