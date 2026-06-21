"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

export function TransferInboxTray() {
  const router = useRouter();
  const [items, setItems] = useState<TransferInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
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

  return (
    <section className="mx-auto mt-6 max-w-6xl rounded-lg border border-amber-200 bg-amber-50/75 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-amber-950">未処理トレイ</h2>
          <p className="mt-1 text-xs text-amber-800">
            Driveから取り込んだ請求書です。OCRは「振込依頼にする」を押した後だけ実行します。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadItems()}
          disabled={loading || !!busyId}
          className="self-start rounded border border-amber-300 px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-100 disabled:opacity-50 sm:self-auto"
        >
          再読み込み
        </button>
      </div>

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
              {items.map((item) => (
                <tr key={item.id} className="border-t border-amber-100">
                  <td className="px-4 py-3 text-gray-900">
                    <div className="font-medium">{item.file_name}</div>
                    {item.public_url && (
                      <a
                        href={item.public_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-amber-700 underline"
                      >
                        プレビュー
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatMimeType(item.mime_type)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDateTime(item.imported_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleCreateTransfer(item)}
                        disabled={!!busyId}
                        className="rounded bg-amber-700 px-3 py-1.5 text-xs text-white hover:bg-amber-800 disabled:opacity-50"
                      >
                        振込依頼にする
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDiscard(item)}
                        disabled={busyId === item.id || !!busyId}
                        className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {busyId === item.id ? "処理中…" : "破棄"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
