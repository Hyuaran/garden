"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { elapsedBusinessDaysSince } from "@/app/bud/transfers/_lib/business-days";

type TransferInboxItem = {
  id: string;
  file_name: string;
  mime_type: "application/pdf" | "image/jpeg" | "image/png";
  public_url: string | null;
  imported_at: string;
  source?: "drive" | "mail" | null;
  mail_meta?: {
    message_id?: string | null;
    attachment_id?: string | null;
    from?: string | null;
    subject?: string | null;
    received_at?: string | null;
  } | null;
};

type InboxListResponse =
  { ok: true; items: TransferInboxItem[] } | { ok: false; error?: string };

type InboxPatchResponse =
  { ok: true; item: TransferInboxItem } | { ok: false; error?: string };

type InboxImportResponse =
  | {
      ok: true;
      drive: ImportSummary;
      mail:
        | ImportSummary
        | {
            ok: true;
            skipped: true;
            reason: "not configured";
            imported: 0;
            failed: 0;
            unsupported: 0;
          };
    }
  | { ok: false; error?: string };

type ImportSummary = {
  ok: true;
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  unsupported?: number;
};

export function TransferInboxTray({
  onCountChange,
}: {
  onCountChange?: (count: number) => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<TransferInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bud/transfer-inbox", {
        cache: "no-store",
      });
      const json = (await res.json()) as InboxListResponse;
      if (!res.ok || !json.ok) {
        throw new Error(
          json.ok
            ? "未処理トレイの取得に失敗しました"
            : (json.error ?? "未処理トレイの取得に失敗しました"),
        );
      }
      setItems(json.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, []);

  useEffect(() => {
    onCountChange?.(items.length);
  }, [items.length, onCountChange]);

  const handleCreateTransfer = (item: TransferInboxItem) => {
    router.push(
      `/bud/transfers/new-regular?inboxId=${encodeURIComponent(item.id)}`,
    );
  };

  const handleDiscard = async (item: TransferInboxItem) => {
    setBusyId(item.id);
    setError(null);
    try {
      const res = await fetch("/api/bud/transfer-inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discard", id: item.id }),
      });
      const json = (await res.json()) as InboxPatchResponse;
      if (!res.ok || !json.ok) {
        throw new Error(
          json.ok ? "破棄に失敗しました" : (json.error ?? "破棄に失敗しました"),
        );
      }
      setItems((current) => current.filter((row) => row.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleImportNow = async () => {
    setImporting(true);
    setImportMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/bud/transfer-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import-now" }),
      });
      const json = (await res.json()) as InboxImportResponse;
      if (!res.ok || !json.ok) {
        throw new Error(
          json.ok
            ? "取り込みに失敗しました"
            : (json.error ?? "取り込みに失敗しました"),
        );
      }
      const mailImported = "reason" in json.mail ? 0 : json.mail.imported;
      const mailFailed = json.mail.failed;
      const totalImported = json.drive.imported + mailImported;
      const totalFailed = json.drive.failed + mailFailed;
      if (totalImported > 0) {
        setImportMessage(
          `${totalImported}件取り込みました（複合機${json.drive.imported}・メール${mailImported}）`,
        );
      } else if (totalFailed > 0) {
        setImportMessage(`新規0件、失敗${totalFailed}件です`);
      } else {
        setImportMessage("新しいファイルはありません");
      }
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="mb-5 rounded-[12px] border border-[#b4a582]/30 bg-[rgba(255,253,246,0.72)] p-5 font-serif shadow-[0_4px_18px_rgba(94,75,42,0.05)]">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-[0.05em] text-[#3d3528]">
            未処理トレイ
          </h2>
          <p className="mt-1 text-xs text-[#6d6356]">
            Driveから取り込んだ請求書です。OCRは「振込依頼にする」を押した後だけ実行します。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => void handleImportNow()}
            disabled={loading || importing || !!busyId}
            className="rounded-full border border-[#b3892e]/35 bg-[#b3892e] px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#987224] disabled:opacity-50"
          >
            {importing ? "取り込み中…" : "今すぐ取り込み"}
          </button>
          <button
            type="button"
            onClick={() => void loadItems()}
            disabled={loading || importing || !!busyId}
            className="rounded-full border border-[#b3892e]/30 bg-white/40 px-4 py-1.5 text-xs text-[#6d6356] hover:bg-[#f7efd8]/60 disabled:opacity-50"
          >
            再読み込み
          </button>
        </div>
      </div>

      {importMessage && (
        <div className="mb-3 rounded-lg border border-[#b4a582]/25 bg-white/55 p-3 text-sm text-[#6d6356]">
          {importMessage}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg border border-[#8f3b36]/25 bg-[#8f3b36]/[0.06] p-3 text-sm text-[#8f3b36]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-[#b4a582]/20 bg-white/45 p-4 text-sm text-[#6d6356]">
          読み込み中…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-[#b4a582]/20 bg-white/45 p-4 text-sm text-[#6d6356]">
          未処理データはありません
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#b4a582]/25 bg-white/55">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#f7efd8]/55 text-left text-xs text-[#6d6356]">
              <tr>
                <th className="px-4 py-3 font-medium">ファイル</th>
                <th className="px-4 py-3 font-medium">形式</th>
                <th className="px-4 py-3 font-medium">取込日時</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const elapsedDays = elapsedBusinessDaysSince(item.imported_at);
                const stalled = elapsedDays > 2;
                return (
                  <tr
                    key={item.id}
                    className={
                      stalled
                        ? "border-t border-[#8f3b36]/20 bg-[#8f3b36]/[0.045]"
                        : "border-t border-[#b4a582]/20"
                    }
                  >
                    <td className="px-4 py-3 text-[#3d3528]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.file_name}</span>
                        {item.source === "mail" && (
                          <span className="rounded-full border border-[#b3892e]/20 bg-[#d4a541]/10 px-2 py-0.5 text-[11px] font-semibold text-[#8d6923]">
                            ✉ メール
                          </span>
                        )}
                      </div>
                      {item.source === "mail" && item.mail_meta && (
                        <div
                          className="mt-1 max-w-md truncate text-xs text-[#9a8f7d]"
                          title={formatMailMeta(item)}
                        >
                          {formatMailMeta(item)}
                        </div>
                      )}
                      {item.public_url && (
                        <a
                          href={item.public_url}
                          target="_blank"
                          rel="noreferrer"
                          className={
                            stalled
                              ? "mt-1 inline-block text-xs text-[#8f3b36] underline"
                              : "mt-1 inline-block text-xs text-[#8d6923] underline"
                          }
                        >
                          プレビュー
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#6d6356]">
                      {formatMimeType(item.mime_type)}
                    </td>
                    <td className="px-4 py-3 text-[#6d6356]">
                      <div>{formatDateTime(item.imported_at)}</div>
                      {stalled && (
                        <span className="mt-1 inline-flex rounded-full border border-[#8f3b36]/25 bg-[#8f3b36]/[0.08] px-2 py-0.5 text-xs font-semibold text-[#8f3b36]">
                          ⚠ 滞留{elapsedDays}営業日
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleCreateTransfer(item)}
                          disabled={!!busyId || importing}
                          className="rounded-full border border-[#b3892e]/35 bg-[#b3892e] px-3 py-1.5 text-xs text-white hover:bg-[#987224] disabled:opacity-50"
                        >
                          振込依頼にする
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDiscard(item)}
                          disabled={busyId === item.id || !!busyId || importing}
                          className="rounded-full border border-[#b4a582]/35 bg-white/35 px-3 py-1.5 text-xs text-[#6d6356] hover:bg-[#f7efd8]/55 disabled:opacity-50"
                        >
                          {busyId === item.id ? "処理中…" : "破棄"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatMimeType(value: TransferInboxItem["mime_type"]) {
  if (value === "application/pdf") return "PDF";
  if (value === "image/png") return "PNG";
  return "JPEG";
}

function formatMailMeta(item: TransferInboxItem) {
  const parts = [item.mail_meta?.from, item.mail_meta?.subject].filter(
    (value): value is string => Boolean(value),
  );
  return parts.join(" / ");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
