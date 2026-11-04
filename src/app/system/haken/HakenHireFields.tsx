"use client";
import { useEffect, useState } from "react";
import type { HakenData } from "@/lib/haken/types";
import IssueButtons from "./IssueButtons";
import styles from "./haken.module.css";
export default function HakenHireFields({
  partyId,
  start,
  end,
  candidateId,
  issueBatchId,
  onPartyChange,
  onEndChange,
  onError,
}: {
  partyId: string;
  start: string;
  end: string;
  candidateId?: string;
  issueBatchId?: string;
  onPartyChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const [data, setData] = useState<HakenData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/system/haken", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!Array.isArray(result?.parties))
          throw new Error("派遣会社を読み込めませんでした。");
        if (active) setData(result);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className={styles.issue} aria-label="派遣">
      <h3>派遣</h3>
      {error && <p role="alert">{error}</p>}
      <div className={styles.grid}>
        <label className={styles.field}>
          <span>
            派遣会社<span className="garden-required">＊</span>
          </span>
          <select
            required
            value={partyId}
            onChange={(e) => onPartyChange(e.target.value)}
            disabled={!data}
          >
            <option value="">{data ? "選んでください" : "読み込み中"}</option>
            {data?.parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>
            派遣期間の終了日<span className="garden-required">＊</span>
          </span>
          <input
            required
            type="date"
            min={start}
            value={end}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </label>
      </div>
      <p>
        一覧に無い会社は
        <a href="/system/haken?tab=parties" target="_blank" rel="noreferrer">
          派遣会社
        </a>
        で登録してください。
      </p>
      {data && (
        <IssueButtons
          data={data}
          partyId={partyId}
          start={start}
          end={end}
          candidateId={candidateId}
          issueBatchId={issueBatchId}
          onError={onError}
        />
      )}
    </section>
  );
}
