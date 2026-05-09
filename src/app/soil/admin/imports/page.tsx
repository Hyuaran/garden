"use client";

/**
 * /soil/admin/imports — Garden-Soil Phase B-01 リストインポート 進捗 UI（admin 専用）
 *
 * 対応 spec:
 *   - docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md（B-01 §4 進捗 UI）
 *
 * 作成: 2026-05-08（Phase B-01 第 4 弾、a-soil）
 *
 * 構成:
 *   - ジョブ一覧（soil_list_imports 連動、最新 50 件）
 *   - 状態バッジ（queued / running / paused / failed / completed / cancelled）
 *   - 進捗 % 表示（chunks_completed / chunks_total）
 *   - 操作ボタン（resume / retry / cancel）
 *
 * 権限:
 *   - admin / super_admin のみ（DB RLS で gate）
 *   - 非権限ユーザーは soil_list_imports SELECT が空配列を返す
 *
 * 注:
 *   - SSE による live 更新は次セッションで追加予定。
 *     現在は手動 refresh ボタン + 5 秒間隔ポーリングで対応。
 *   - Soil ガード（SoilGate / SoilShell）は未実装、次セッションで整備予定。
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../_lib/supabase";
import {
  startImportJob,
  pauseImportJob,
  resumeImportJob,
  retryImportJob,
  cancelImportJob,
  createPhase2ImportJob,
} from "@/lib/db/soil-import-actions";

// ============================================================
// 型定義
// ============================================================

type ImportJobRow = {
  id: string;
  source_system: string;
  source_label: string | null;
  imported_at: string;
  job_status:
    | "queued"
    | "running"
    | "paused"
    | "failed"
    | "completed"
    | "cancelled"
    | null;
  chunks_total: number | null;
  chunks_completed: number | null;
  total_records: number | null;
  inserted_count: number | null;
  failed_count: number | null;
  started_at: string | null;
  completed_at: string | null;
  last_chunk_completed_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  queued: "待機中",
  running: "実行中",
  paused: "一時停止",
  failed: "失敗",
  completed: "完了",
  cancelled: "キャンセル",
};

const STATUS_BG: Record<string, string> = {
  queued: "bg-gray-100 text-gray-800",
  running: "bg-blue-100 text-blue-800",
  paused: "bg-amber-100 text-amber-800",
  failed: "bg-rose-100 text-rose-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-gray-200 text-gray-700",
};

// ソース別フィルタ + 表示用ラベル
const SOURCE_FILTER_OPTIONS = [
  { value: "all", label: "すべて" },
  { value: "kintone-app-55", label: "Kintone 関電（Phase 1）" },
  { value: "filemaker-list2024", label: "FileMaker（Phase 2）" },
] as const;
type SourceFilter = (typeof SOURCE_FILTER_OPTIONS)[number]["value"];

const SOURCE_BADGE: Record<string, string> = {
  "kintone-app-55": "bg-sky-50 text-sky-700 border border-sky-200",
  "filemaker-list2024": "bg-violet-50 text-violet-700 border border-violet-200",
};

function sourceLabel(sourceSystem: string): string {
  if (sourceSystem === "kintone-app-55") return "Kintone (P1)";
  if (sourceSystem === "filemaker-list2024") return "FileMaker (P2)";
  return sourceSystem;
}

// ============================================================
// メインコンポーネント
// ============================================================

export default function SoilImportsAdminPage() {
  const [jobs, setJobs] = useState<ImportJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  // Phase 2 ジョブ作成フォーム
  const [showPhase2Form, setShowPhase2Form] = useState(false);
  const [phase2Label, setPhase2Label] = useState("");
  const [phase2Notes, setPhase2Notes] = useState("");
  const [phase2Pending, setPhase2Pending] = useState(false);
  const [phase2CreatedJobId, setPhase2CreatedJobId] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase
      .from("soil_list_imports")
      .select(
        "id, source_system, source_label, imported_at, job_status, chunks_total, chunks_completed, total_records, inserted_count, failed_count, started_at, completed_at, last_chunk_completed_at",
      )
      .is("deleted_at", null)
      .order("imported_at", { ascending: false })
      .limit(50);

    if (e) {
      setError(e.message);
      setJobs([]);
    } else {
      setJobs((data ?? []) as ImportJobRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadJobs();
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const filteredJobs = useMemo(() => {
    if (sourceFilter === "all") return jobs;
    return jobs.filter((j) => j.source_system === sourceFilter);
  }, [jobs, sourceFilter]);

  const handleCreatePhase2 = useCallback(async () => {
    setError(null);
    setPhase2CreatedJobId(null);
    if (!phase2Label.trim()) {
      setError("CSV ファイル名（source_label）を入力してください");
      return;
    }
    setPhase2Pending(true);
    try {
      const result = await createPhase2ImportJob({
        supabase,
        sourceLabel: phase2Label,
        notes: phase2Notes,
      });
      if (!result.ok) {
        setError(result.error ?? "Phase 2 ジョブ作成に失敗");
        return;
      }
      setPhase2CreatedJobId(result.jobId ?? null);
      setPhase2Label("");
      setPhase2Notes("");
      await loadJobs();
    } finally {
      setPhase2Pending(false);
    }
  }, [phase2Label, phase2Notes, loadJobs]);

  const handleAction = useCallback(
    async (
      jobId: string,
      action: "start" | "pause" | "resume" | "retry" | "cancel",
    ) => {
      setActionPending(`${jobId}:${action}`);
      try {
        const input = { supabase, importJobId: jobId };
        let result: { ok: boolean; error?: string };
        switch (action) {
          case "start":
            result = await startImportJob(input);
            break;
          case "pause":
            result = await pauseImportJob(input);
            break;
          case "resume":
            result = await resumeImportJob(input);
            break;
          case "retry":
            result = await retryImportJob(input);
            break;
          case "cancel":
            result = await cancelImportJob(input);
            break;
        }
        if (!result.ok) {
          setError(result.error ?? `${action} failed`);
        } else {
          await loadJobs();
        }
      } finally {
        setActionPending(null);
      }
    },
    [loadJobs],
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            リストインポート進捗（admin）
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Garden-Soil リストインポートジョブの一覧 + 操作（admin / super_admin
            のみ閲覧可）
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link href="/soil" className="text-emerald-600 hover:underline">
            ← Soil トップ
          </Link>
          <button
            type="button"
            onClick={() => setShowPhase2Form((s) => !s)}
            className="rounded bg-violet-600 px-3 py-1 text-white hover:bg-violet-700"
          >
            + Phase 2 取込ジョブ作成
          </button>
          <button
            type="button"
            onClick={() => void loadJobs()}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-gray-700 hover:bg-gray-50"
          >
            ↻ 更新
          </button>
        </nav>
      </header>

      {/* Phase 2 ジョブ作成フォーム */}
      {showPhase2Form ? (
        <section className="mb-4 rounded-lg border border-violet-200 bg-violet-50 p-4">
          <h2 className="mb-3 text-sm font-bold text-violet-900">
            Phase 2 取込ジョブ作成（FileMaker CSV 200 万件）
          </h2>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="block text-xs text-gray-700">
              CSV ファイル名（source_label）<span className="text-rose-600">*</span>
              <input
                type="text"
                value={phase2Label}
                onChange={(e) => setPhase2Label(e.target.value)}
                placeholder="filemaker-list-export-YYYYMMDD-HHMM.csv"
                className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                disabled={phase2Pending}
              />
            </label>
            <label className="block text-xs text-gray-700">
              メモ（任意）
              <input
                type="text"
                value={phase2Notes}
                onChange={(e) => setPhase2Notes(e.target.value)}
                placeholder="α テスト / 本番 200 万件 等"
                className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                disabled={phase2Pending}
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void handleCreatePhase2()}
              disabled={phase2Pending || phase2Label.trim() === ""}
              className="rounded bg-violet-600 px-3 py-1 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {phase2Pending ? "作成中…" : "ジョブ作成"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPhase2Form(false);
                setPhase2CreatedJobId(null);
              }}
              className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700"
            >
              閉じる
            </button>
          </div>
          {phase2CreatedJobId ? (
            <div className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-xs">
              <p className="font-medium text-emerald-800">
                ✅ ジョブ作成完了。job_status=&quot;queued&quot; で登録されました。
              </p>
              <p className="mt-1 text-emerald-700">
                Job ID: <code className="rounded bg-white px-1 py-0.5">{phase2CreatedJobId}</code>
              </p>
              <p className="mt-2 text-emerald-700">
                以下のコマンドを CLI（PowerShell / bash）で実行して取込開始:
              </p>
              <pre className="mt-1 overflow-x-auto rounded bg-gray-900 p-2 text-emerald-100">
                {`npx tsx scripts/soil-import-csv-phase2.ts \\
  "<csv-file-path>" \\
  "${phase2CreatedJobId}" \\
  10000`}
              </pre>
              <p className="mt-2 text-xs text-emerald-700">
                ※ 取込開始前に admin が SQL Editor で
                <code className="mx-1 rounded bg-white px-1 py-0.5">
                  select * from public.soil_phase2_drop_bulk_load_indexes();
                </code>
                を実行して INDEX を一時 DROP（spec §6.1）。
                <br />※ 完了後に scripts/soil-phase2-recreate-indexes.sql を SQL Editor で実行し
                INDEX を CONCURRENTLY で再構築 + ANALYZE。
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ソースフィルタ */}
      <div className="mb-3 flex items-center gap-2 text-xs">
        <span className="text-gray-500">フィルタ:</span>
        {SOURCE_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSourceFilter(opt.value)}
            className={`rounded px-2 py-1 ${
              sourceFilter === opt.value
                ? "bg-emerald-600 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error ? (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-800 rounded p-4 mb-4"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-center py-8 text-gray-500">読み込み中…</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">取込日時</th>
                <th className="px-3 py-2 text-left">ソース</th>
                <th className="px-3 py-2 text-left">ラベル</th>
                <th className="px-3 py-2 text-left">状態</th>
                <th className="px-3 py-2 text-right">進捗</th>
                <th className="px-3 py-2 text-right">成功 / 失敗</th>
                <th className="px-3 py-2 text-left">最終 chunk</th>
                <th className="px-3 py-2 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-900">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-gray-400"
                  >
                    {sourceFilter === "all"
                      ? "インポートジョブがありません（admin 権限が必要、または soil_list_imports が空）"
                      : `${SOURCE_FILTER_OPTIONS.find((o) => o.value === sourceFilter)?.label} のジョブはありません`}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((j) => {
                  const status = j.job_status ?? "queued";
                  const progressPct =
                    j.chunks_total && j.chunks_total > 0
                      ? Math.round(
                          ((j.chunks_completed ?? 0) / j.chunks_total) * 100,
                        )
                      : 0;
                  return (
                    <tr key={j.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-700">
                        {new Date(j.imported_at).toLocaleString("ja-JP")}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            SOURCE_BADGE[j.source_system] ??
                            "bg-gray-100 text-gray-700 border border-gray-200"
                          }`}
                        >
                          {sourceLabel(j.source_system)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 truncate max-w-xs">
                        {j.source_label ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            STATUS_BG[status] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {STATUS_LABELS[status] ?? status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-700">
                        {j.chunks_completed ?? 0} / {j.chunks_total ?? "—"} (
                        {progressPct}%)
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        <span className="text-emerald-700">
                          {j.inserted_count ?? 0}
                        </span>
                        {" / "}
                        <span
                          className={
                            (j.failed_count ?? 0) > 0
                              ? "text-rose-700 font-medium"
                              : "text-gray-400"
                          }
                        >
                          {j.failed_count ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {j.last_chunk_completed_at
                          ? new Date(
                              j.last_chunk_completed_at,
                            ).toLocaleString("ja-JP")
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <JobActions
                          status={status}
                          jobId={j.id}
                          actionPending={actionPending}
                          onAction={handleAction}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        {filteredJobs.length} / {jobs.length} 件表示（最新 50 件、5 秒間隔で自動更新）
      </p>
    </div>
  );
}

// ============================================================
// 操作ボタン群
// ============================================================

function JobActions(props: {
  status: string;
  jobId: string;
  actionPending: string | null;
  onAction: (
    jobId: string,
    action: "start" | "pause" | "resume" | "retry" | "cancel",
  ) => void;
}) {
  const { status, jobId, actionPending, onAction } = props;
  const isPending = (a: string) => actionPending === `${jobId}:${a}`;

  const buttons: { action: "start" | "pause" | "resume" | "retry" | "cancel"; label: string; show: boolean; cls: string }[] = [
    { action: "start", label: "開始", show: status === "queued", cls: "bg-blue-600 hover:bg-blue-700 text-white" },
    { action: "pause", label: "一時停止", show: status === "running", cls: "bg-amber-500 hover:bg-amber-600 text-white" },
    { action: "resume", label: "再開", show: status === "paused", cls: "bg-blue-600 hover:bg-blue-700 text-white" },
    { action: "retry", label: "リトライ", show: status === "failed", cls: "bg-rose-600 hover:bg-rose-700 text-white" },
    { action: "cancel", label: "キャンセル", show: status === "running" || status === "paused", cls: "bg-gray-500 hover:bg-gray-600 text-white" },
  ];

  return (
    <div className="flex gap-1 justify-center">
      {buttons
        .filter((b) => b.show)
        .map((b) => (
          <button
            key={b.action}
            type="button"
            disabled={isPending(b.action)}
            onClick={() => onAction(jobId, b.action)}
            className={`text-xs px-2 py-1 rounded ${b.cls} disabled:opacity-50`}
          >
            {isPending(b.action) ? "…" : b.label}
          </button>
        ))}
      {buttons.filter((b) => b.show).length === 0 ? (
        <span className="text-xs text-gray-400">—</span>
      ) : null}
    </div>
  );
}
