"use client";

import { type CSSProperties, useEffect, useState } from "react";
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
    <section style={panelStyle}>
      <div style={panelHeadStyle}>
        <div>
          <h2 style={panelTitleStyle}>
            未処理トレイ
          </h2>
          <p style={panelMetaStyle}>
            Driveから取り込んだ請求書です。OCRは「振込依頼にする」を押した後だけ実行します。
          </p>
        </div>
        <div style={actionGroupStyle}>
          <button
            type="button"
            onClick={() => void handleImportNow()}
            disabled={loading || importing || !!busyId}
            style={buttonStyle(primaryButtonStyle, loading || importing || !!busyId)}
          >
            {importing ? "取り込み中…" : "今すぐ取り込み"}
          </button>
          <button
            type="button"
            onClick={() => void loadItems()}
            disabled={loading || importing || !!busyId}
            style={buttonStyle(secondaryButtonStyle, loading || importing || !!busyId)}
          >
            再読み込み
          </button>
        </div>
      </div>

      {importMessage && (
        <div style={successStyle}>
          {importMessage}
        </div>
      )}

      {error && (
        <div style={errorStyle}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={noticeStyle}>
          読み込み中…
        </div>
      ) : items.length === 0 ? (
        <div style={noticeStyle}>
          未処理データはありません
        </div>
      ) : (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>ファイル</th>
                <th style={thStyle}>形式</th>
                <th style={thStyle}>取込日時</th>
                <th style={{ ...thStyle, textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const elapsedDays = elapsedBusinessDaysSince(item.imported_at);
                const stalled = elapsedDays > 2;
                return (
                  <tr
                    key={item.id}
                    style={stalled ? stalledRowStyle : undefined}
                  >
                    <td style={tdStyle}>
                      <div style={fileNameRowStyle}>
                        <span style={fileNameStyle}>{item.file_name}</span>
                        {item.source === "mail" && (
                          <span style={mailBadgeStyle}>
                            ✉ メール
                          </span>
                        )}
                      </div>
                      {item.source === "mail" && item.mail_meta && (
                        <div
                          style={mailMetaStyle}
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
                          style={stalled ? stalledLinkStyle : previewLinkStyle}
                        >
                          プレビュー
                        </a>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {formatMimeType(item.mime_type)}
                    </td>
                    <td style={tdStyle}>
                      <div>{formatDateTime(item.imported_at)}</div>
                      {stalled && (
                        <span style={stalledBadgeStyle}>
                          ⚠ 滞留{elapsedDays}営業日
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={rowActionStyle}>
                        <button
                          type="button"
                          onClick={() => handleCreateTransfer(item)}
                          disabled={!!busyId || importing}
                          style={buttonStyle(
                            primarySmallButtonStyle,
                            !!busyId || importing,
                          )}
                        >
                          振込依頼にする
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDiscard(item)}
                          disabled={busyId === item.id || !!busyId || importing}
                          style={buttonStyle(
                            secondarySmallButtonStyle,
                            busyId === item.id || !!busyId || importing,
                          )}
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

const serifFont = "'Shippori Mincho', 'Noto Serif JP', serif";
const panelStyle: CSSProperties = {
  marginBottom: 20,
  padding: "18px 20px",
  border: "1px solid rgba(180,165,130,0.22)",
  borderRadius: 12,
  background: "rgba(255,253,246,0.72)",
  boxShadow: "0 4px 18px rgba(94,75,42,0.05)",
  fontFamily: serifFont,
};
const panelHeadStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 16,
  flexWrap: "wrap",
  paddingBottom: 10,
  marginBottom: 12,
  borderBottom: "1px dashed rgba(179,137,46,0.32)",
};
const panelTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-main)",
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: "0.05em",
};
const panelMetaStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "var(--text-muted)",
  fontSize: 12,
};
const actionGroupStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};
const buttonBaseStyle: CSSProperties = {
  minHeight: 32,
  padding: "6px 14px",
  borderRadius: 999,
  fontFamily: serifFont,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(94,75,42,0.04)",
};
const primaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  border: "1px solid rgba(179,137,46,0.35)",
  background: "rgba(179,137,46,0.88)",
  color: "rgba(255,253,246,0.98)",
};
const secondaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  border: "1px solid rgba(179,137,46,0.28)",
  background: "rgba(255,255,255,0.42)",
  color: "var(--text-sub)",
};
const primarySmallButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  minHeight: 30,
  padding: "5px 12px",
  fontSize: 11,
};
const secondarySmallButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  minHeight: 30,
  padding: "5px 12px",
  fontSize: 11,
};
const noticeStyle: CSSProperties = {
  padding: 20,
  border: "1px solid rgba(180,165,130,0.18)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.42)",
  color: "var(--text-sub)",
  textAlign: "center",
  fontSize: 12,
};
const successStyle: CSSProperties = {
  ...noticeStyle,
  padding: 10,
  marginBottom: 10,
  borderColor: "rgba(108,132,76,0.24)",
  background: "rgba(108,132,76,0.07)",
  color: "var(--text-sub)",
  textAlign: "left",
};
const errorStyle: CSSProperties = {
  ...noticeStyle,
  padding: 10,
  marginBottom: 10,
  borderColor: "rgba(143,59,54,0.25)",
  background: "rgba(143,59,54,0.07)",
  color: "rgba(143,59,54,0.96)",
  textAlign: "left",
};
const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid rgba(180,165,130,0.22)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.46)",
};
const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: 760,
  borderCollapse: "collapse",
  fontFamily: serifFont,
  fontSize: 12,
};
const thStyle: CSSProperties = {
  padding: "9px 12px",
  borderBottom: "1px solid rgba(180,165,130,0.25)",
  background: "rgba(247,239,216,0.34)",
  color: "var(--text-sub)",
  fontWeight: 500,
  textAlign: "left",
  whiteSpace: "nowrap",
};
const tdStyle: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px dashed rgba(180,165,130,0.18)",
  color: "var(--text-main)",
  verticalAlign: "middle",
};
const stalledRowStyle: CSSProperties = {
  background: "rgba(143,59,54,0.045)",
};
const fileNameRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
};
const fileNameStyle: CSSProperties = {
  fontWeight: 600,
};
const mailBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid rgba(179,137,46,0.2)",
  borderRadius: 999,
  background: "rgba(212,165,65,0.1)",
  padding: "2px 8px",
  color: "var(--text-sub)",
  fontSize: 11,
  fontWeight: 600,
};
const mailMetaStyle: CSSProperties = {
  marginTop: 4,
  maxWidth: 448,
  overflow: "hidden",
  color: "var(--text-muted)",
  fontSize: 12,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const previewLinkStyle: CSSProperties = {
  display: "inline-block",
  marginTop: 4,
  color: "var(--text-sub)",
  fontSize: 12,
  textDecoration: "underline",
};
const stalledLinkStyle: CSSProperties = {
  ...previewLinkStyle,
  color: "rgba(143,59,54,0.96)",
};
const stalledBadgeStyle: CSSProperties = {
  display: "inline-flex",
  marginTop: 4,
  border: "1px solid rgba(143,59,54,0.25)",
  borderRadius: 999,
  background: "rgba(143,59,54,0.08)",
  padding: "2px 8px",
  color: "rgba(143,59,54,0.96)",
  fontSize: 12,
  fontWeight: 600,
};
const rowActionStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};

function buttonStyle(
  style: CSSProperties,
  disabled: boolean,
): CSSProperties {
  if (!disabled) return style;
  return {
    ...style,
    cursor: "not-allowed",
    opacity: 0.5,
  };
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
