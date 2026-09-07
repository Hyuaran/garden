"use client";

import { useEffect, useState } from "react";
import type { KanriDisplayPayload } from "@/app/system/kanri/_lib/kanri-display";
import styles from "./display.module.css";

export type DisplayData =
  | KanriDisplayPayload
  | { ok: true; empty: true; message: string }
  | { ok: false; message: string };

const REFRESH_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_KANRI_DISPLAY_REFRESH_MS ?? 5 * 60 * 1000);

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function fetchDisplayData(): Promise<DisplayData> {
  const response = await fetch("/api/system/kanri/display", { cache: "no-store" });
  if (response.status === 403) return { ok: false, message: "ログインし直してください" };
  const json = await response.json().catch(() => null) as DisplayData | null;
  if (!response.ok || !json) return { ok: false, message: "表示する成績を読み込めませんでした" };
  return json;
}

export default function DisplayClient({ initialData }: { initialData: DisplayData }) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    let active = true;
    async function refresh() {
      const next = await fetchDisplayData();
      if (active) setData(next);
    }
    const timer = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!data.ok) {
    return <main className={styles.shell}><div className={styles.message}>{data.message}</div></main>;
  }
  if (data.empty) {
    return <main className={styles.shell}><div className={styles.message}>{data.message}</div></main>;
  }

  return <main className={styles.shell}>
    <section className={styles.board} aria-label="ディスプレイ用成績">
      <h1>{data.title}</h1>
      <table className={styles.scoreTable}>
        <thead>
          <tr>
            <th aria-label="項目"></th>
            {data.columns.map((column) => <th key={column.key}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => <tr key={row.key} className={row.emphasis ? styles.emphasisRow : undefined}>
            <th>{row.label}</th>
            {row.values.map((value, index) => <td key={`${row.key}-${data.columns[index]?.key}`}>{value}</td>)}
          </tr>)}
        </tbody>
      </table>
    </section>
    <p className={styles.updatedAt}>最終更新 {formatUpdatedAt(data.calculatedAt)}</p>
  </main>;
}
