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
};

type InboxListResponse =
  | { ok: true; items: TransferInboxItem[] }
  | { ok: false; error?: string };

type InboxPatchResponse =
  | { ok: true; item: TransferInboxItem }
  | { ok: false; error?: string };

type InboxImportResponse =
  | { ok: true; total: number; imported: number; skipped: number; failed: number }
  | { ok: false; error?: string };

export function TransferInboxTray() {
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
        throw new Error(json.ok ? "未処理トレイの取得に失敗しました" : json.error ?? "未処理トレイの取得に失敗しました");
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

  const handleCreateTransfer = (item: TransferInboxItem) => {
    router.push(`/bud/transfers/new-regular?inboxId=${encodeURIComponent(item.id)}`);
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
        throw new Error(json.ok ? "破棄に失敗しました" : json.error ?? "破棄に失敗しました");
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
        throw new Error(json.ok ? "取り込みに失敗しました" : json.error ?? "取り込みに失敗しました");
      }
      if (json.imported > 0) {
        setImportMessage(`${json.imported}件取り込みました`);
      } else if (json.failed > 0) {
        setImportMessage(`新規0件、失敗${json.failed}件です`);
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
    <section className="mx-auto mt-6 max-w-6xl rounded-lg border border-amber-200 bg-amber-50/75 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-amber-950">未処理トレイ</h2>
          <p className="mt-1 text-xs text-amber-800">
            Driveから取り込んだ請求書です。OCRは「振込依頼にする」を押した後だけ実行します。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => void handleImportNow()}
            disabled={loading || importing || !!busyId}
            className="rounded bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {importing ? "取り込み中…" : "今すぐ取り込み"}
          </button>
          <button
            type="button"
            onClick={() => void loadItems()}
            disabled={loading || importing || !!busyId}
            className="rounded border border-amber-300 px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            再読み込み
          </button>
        </div>
      </div>

      {importMessage && (
        <div className="mb-3 rounded border border-amber-200 bg-white/80 p-3 text-sm text-amber-900">
          {importMessage}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded border border-amber-100 bg-white/70 p-4 text-sm text-amber-800">
          読み込み中…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded border border-amber-100 bg-white/70 p-4 text-sm text-amber-800">
          未処理の請求書はありません。
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-amber-100 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-amber-100/70 text-left text-xs text-amber-900">
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
                    className={stalled ? "border-t border-red-200 bg-red-50/80" : "border-t border-amber-100"}
                  >
                    <td className="px-4 py-3 text-gray-900">
                      <div className="font-medium">{item.file_name}</div>
                      {item.public_url && (
                        <a
                          href={item.public_url}
                          target="_blank"
                          rel="noreferrer"
                          className={stalled ? "mt-1 inline-block text-xs text-red-700 underline" : "mt-1 inline-block text-xs text-amber-700 underline"}
                        >
                          プレビュー
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatMimeType(item.mime_type)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{formatDateTime(item.imported_at)}</div>
                      {stalled && (
                        <span className="mt-1 inline-flex rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
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
                          className="rounded bg-amber-700 px-3 py-1.5 text-xs text-white hover:bg-amber-800 disabled:opacity-50"
                        >
                          振込依頼にする
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDiscard(item)}
                          disabled={busyId === item.id || !!busyId || importing}
                          className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
