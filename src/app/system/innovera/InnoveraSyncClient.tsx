"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import type { InnoveraSyncDetail, InnoveraSyncLogRow, InnoveraSyncResult } from "@/lib/innovera/types";
import styles from "./innovera.module.css";

type Props = {
  initialLogs: InnoveraSyncLogRow[];
};

function countsText(counts: { added: number; renamed: number; retired: number; needsReview: number; failed?: number }) {
  const base = `新規 ${counts.added}件・名称変更 ${counts.renamed}件・廃止 ${counts.retired}件・要確認 ${counts.needsReview}件`;
  return counts.failed ? `${base}・失敗 ${counts.failed}件` : base;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "未実行";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function kindLabel(kind: InnoveraSyncDetail["kind"]) {
  if (kind === "added") return "新規";
  if (kind === "renamed") return "名称変更";
  if (kind === "retired") return "廃止";
  return "要確認";
}

function detailText(item: InnoveraSyncDetail) {
  if (item.kind === "added") return `${item.fdNumber ?? ""} ／ ${item.nextName ?? ""}${item.issuedDate ? `（発番 ${item.issuedDate}）` : ""}`;
  if (item.kind === "renamed") return `${item.previousName ?? ""} → ${item.nextName ?? ""}`;
  if (item.kind === "retired") return item.previousName ?? "";
  if (item.reason === "restored_deleted") return "削除済みの番号が戻っています";
  return `回線番号が Kintone と違います${item.previousLineNumber ? `（Kintone: ${item.previousLineNumber}）` : ""}`;
}

function errorText(error?: string) {
  if (!error) return "";
  const primary = error.split(";")[0]?.trim() ?? error;
  if (primary === "not_configured") return "設定が終わっていません。管理者へ問い合わせてください";
  if (primary === "innovera_empty") return "INNOVERA から回線が 1 件も返りませんでした（安全のため何も書いていません）";
  if (primary.startsWith("innovera_")) return "INNOVERA に接続できませんでした";
  if (primary.startsWith("kintone_")) return "Kintone の読み書きに失敗しました";
  return "反映できませんでした";
}

function toDetails(result: InnoveraSyncResult | null): InnoveraSyncDetail[] {
  return result?.details ?? [];
}

function InnoveraProcessingOverlay({ open }: { open: boolean }) {
  if (!open) return null;
  return createPortal(
    <div className={styles.processingOverlay} role="status" aria-live="assertive" aria-label="Kintone に反映しています">
      <div className={styles.processingSpinner} aria-hidden="true" />
      <strong>Kintone に反映しています</strong>
      <div>この画面を閉じないでください</div>
    </div>,
    document.body,
  );
}

export default function InnoveraSyncClient({ initialLogs }: Props) {
  const [logs, setLogs] = useState(initialLogs);
  const [preview, setPreview] = useState<InnoveraSyncResult | null>(null);
  const [lastResult, setLastResult] = useState<InnoveraSyncResult | null>(null);
  const [loading, setLoading] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const latest = useMemo(() => {
    if (lastResult?.applied) return lastResult;
    const row = logs.find((log) => log.applied);
    if (!row) return null;
    return {
      ranAt: row.ran_at,
      trigger: row.trigger,
      counts: {
        added: row.added,
        renamed: row.renamed,
        retired: row.retired,
        needsReview: row.needs_review,
        failed: row.failed,
      },
    };
  }, [lastResult, logs]);
  const appliedLogs = logs.filter((log) => log.applied);

  async function request(method: "GET" | "POST") {
    setLoading(method === "GET" ? "preview" : "apply");
    setError(null);
    try {
      const response = await fetch("/api/system/innovera-sync", { method });
      const body = await response.json() as InnoveraSyncResult;
      if (Array.isArray(body.latestLogs)) setLogs(body.latestLogs);
      if (!body.ok) {
        setError(errorText(body.error));
      }
      if (method === "GET") {
        setPreview(body);
      } else {
        setLastResult(body);
        setPreview(body.ok ? { ...body, details: [], actions: [], counts: { ...body.counts, added: 0, renamed: 0, retired: 0, needsReview: 0 } } : body);
      }
    } catch {
      setError("通信に失敗しました");
    } finally {
      setLoading(null);
    }
  }

  const details = toDetails(preview);
  const canApply = !!preview && preview.ok && details.some((item) => item.result === "pending");

  return <div className={styles.pageShell}>
    <InnoveraProcessingOverlay open={loading === "apply"} />
    <header className={styles.header}>
      <SystemBreadcrumb items={[{ label: "業務管理ツール", href: "/system/forms" }, { label: "INNOVERA番号の同期" }]} />
      <h1>INNOVERA番号の同期</h1>
      <p>INNOVERA の回線一覧と Kintone の番号一覧を 5 分ごとに突き合わせ、差分だけを Kintone に写します。使用中・未使用の区別は Kintone で人が決めます。変更があったときは Chatwork「Garden通知」にも知らせます。</p>
    </header>

    <section className={styles.lastBox} aria-label="最後の反映">
      <h2>最後の反映</h2>
      <p>{latest ? `${formatDateTime(latest.ranAt)}（${latest.trigger === "cron" ? "自動" : "手動"}） ${countsText(latest.counts)}` : "まだ反映履歴がありません"}</p>
    </section>

    <div className={styles.actions}>
      <button type="button" onClick={() => request("GET")} disabled={loading !== null}>{loading === "preview" ? "確認中..." : "いまの差分を見る"}</button>
      <button type="button" onClick={() => request("POST")} disabled={!canApply || loading !== null}>{loading === "apply" ? "反映中..." : "今すぐ反映"}</button>
    </div>

    {error ? <p className={styles.error} role="alert">反映できませんでした：{error}</p> : null}

    <section className={styles.diffSection}>
      <h2>差分の一覧{preview ? `（${formatDateTime(preview.ranAt)} 時点）` : ""}</h2>
      {preview && details.length === 0 ? <p className={styles.empty}>差分はありません。Kintone は最新です。</p> : null}
      {details.length > 0 ? <div className={styles.tableWrap}>
        <table>
          <thead><tr><th>種類</th><th>識別番号</th><th>回線番号</th><th>内容</th></tr></thead>
          <tbody>
            {details.map((item, index) => <tr key={`${item.kind}-${item.circuitNum}-${index}`}>
              <td data-label="種類"><span className={`${styles.badge} ${styles[item.kind]}`}>{kindLabel(item.kind)}</span></td>
              <td data-label="識別番号">{item.circuitNum}</td>
              <td data-label="回線番号">{item.lineNumber}</td>
              <td data-label="内容">{detailText(item)}{item.result === "failed" ? `（失敗：${item.error ?? ""}）` : ""}</td>
            </tr>)}
          </tbody>
        </table>
      </div> : null}
    </section>

    <section className={styles.history}>
      <h2>これまでの反映</h2>
      {appliedLogs.length === 0 ? <p className={styles.empty}>履歴はまだありません。</p> : appliedLogs.map((log) => {
        const logDetails = Array.isArray(log.details) ? log.details as InnoveraSyncDetail[] : [];
        return <details key={log.id ?? log.ran_at} className={styles.logItem}>
          <summary>{formatDateTime(log.ran_at)} ／ {log.trigger === "cron" ? "自動" : "手動"} ／ {countsText({ added: log.added, renamed: log.renamed, retired: log.retired, needsReview: log.needs_review, failed: log.failed })}</summary>
          {log.error ? <p className={styles.errorSmall}>{errorText(log.error)}</p> : null}
          {logDetails.length > 0 ? <ul>{logDetails.map((item, index) => <li key={`${item.kind}-${item.circuitNum}-${index}`}>{kindLabel(item.kind)}：{item.circuitNum} {detailText(item)}</li>)}</ul> : <p>明細はありません。</p>}
        </details>;
      })}
    </section>
  </div>;
}
