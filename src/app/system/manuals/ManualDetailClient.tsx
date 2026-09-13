"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import type { ManualDefinition, ManualDoc, ManualModule } from "./_lib/manuals-registry";
import { renderMarkdown } from "./_lib/render-markdown";
import styles from "./manuals.module.css";

type ManualVersion = {
  id: string;
  uploaded_at: string;
  uploaded_by: string | null;
  size: number | null;
  storage_path: string;
  note?: string | null;
};

export default function ManualDetailClient({
  module,
  manual,
  docs,
  selectedDoc,
  canManageVersions = false,
}: {
  module: ManualModule;
  manual: ManualDefinition;
  docs: ManualDoc[];
  selectedDoc?: ManualDoc;
  canManageVersions?: boolean;
}) {
  const [height, setHeight] = useState(600);
  const [markdown, setMarkdown] = useState({ src: "", html: "", error: "" });
  const [refreshKey, setRefreshKey] = useState("");
  const [versions, setVersions] = useState<{ current: ManualVersion | null; versions: ManualVersion[]; loading: boolean }>({ current: null, versions: [], loading: false });
  const [versionMessage, setVersionMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"replace" | "restore" | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const src = useMemo(() => {
    if (!selectedDoc) return "";
    const base = `/api/system/manuals/${manual.moduleSlug}/${manual.slug}/${selectedDoc.file}`;
    const bust = refreshKey ? `${selectedDoc.kind === "html" ? "&" : "?"}v=${encodeURIComponent(refreshKey)}` : "";
    return selectedDoc.kind === "html" ? `${base}?embed=1${bust}` : `${base}${bust}`;
  }, [manual.moduleSlug, manual.slug, selectedDoc, refreshKey]);
  const versionsEndpoint = selectedDoc ? `/api/system/manuals/${manual.moduleSlug}/${manual.slug}/${selectedDoc.file}/versions` : "";
  const replaceEndpoint = selectedDoc ? `/api/system/manuals/${manual.moduleSlug}/${manual.slug}/${selectedDoc.file}/replace` : "";
  const restoreEndpoint = selectedDoc ? `/api/system/manuals/${manual.moduleSlug}/${manual.slug}/${selectedDoc.file}/restore` : "";

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const docHeight = typeof event.data?.__docHeight === "number" ? event.data.__docHeight : null;
      if (docHeight) setHeight(Math.max(600, Math.ceil(docHeight)));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!selectedDoc || selectedDoc.kind !== "md") return;
    let cancelled = false;
    fetch(src, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("not found");
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setMarkdown({ src, html: renderMarkdown(text), error: "" });
      })
      .catch(() => {
        if (!cancelled) setMarkdown({ src, html: "", error: "この資料はまだ登録されていません。管理者へお問い合わせください。" });
      });
    return () => { cancelled = true; };
  }, [selectedDoc, src]);

  useEffect(() => {
    if (!selectedDoc || !canManageVersions) return;
    let cancelled = false;
    setVersions((current) => ({ ...current, loading: true }));
    fetch(versionsEndpoint, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "版の履歴を読み込めませんでした");
        return payload as { current: ManualVersion | null; versions: ManualVersion[] };
      })
      .then((payload) => {
        if (!cancelled) {
          setVersions({ current: payload.current, versions: payload.versions, loading: false });
          setVersionMessage("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setVersions({ current: null, versions: [], loading: false });
          setVersionMessage(error instanceof Error ? error.message : "版の履歴を読み込めませんでした");
        }
      });
    return () => { cancelled = true; };
  }, [canManageVersions, selectedDoc, versionsEndpoint, refreshKey]);

  function chooseFile(file: File | null) {
    setVersionMessage("");
    setUploadFile(file);
  }

  function dropUpload(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    chooseFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function handleReplace() {
    if (!uploadFile || !selectedDoc) return;
    setBusy("replace");
    setVersionMessage("");
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      const response = await fetch(replaceEndpoint, { method: "POST", body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "差し替えられませんでした");
      setModalOpen(false);
      setUploadFile(null);
      setRefreshKey(String(Date.now()));
      setVersionMessage("差し替えました（旧版の履歴に残しました）。");
    } catch (error) {
      setVersionMessage(error instanceof Error ? error.message : "差し替えられませんでした");
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore(version: ManualVersion) {
    if (!selectedDoc) return;
    const label = formatDateTime(version.uploaded_at);
    if (!window.confirm(`${label} の版に戻します。いまの版は履歴に残ります。`)) return;
    setBusy("restore");
    setVersionMessage("");
    try {
      const response = await fetch(restoreEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: version.id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "この版に戻せませんでした");
      setRefreshKey(String(Date.now()));
      setVersionMessage("この版に戻しました（いまの版を履歴に残しました）。");
    } catch (error) {
      setVersionMessage(error instanceof Error ? error.message : "この版に戻せませんでした");
    } finally {
      setBusy(null);
    }
  }

  function versionPreviewHref(version: ManualVersion) {
    if (!selectedDoc) return "";
    return `/api/system/manuals/${manual.moduleSlug}/${manual.slug}/${selectedDoc.file}/versions/${version.id}${selectedDoc.kind === "html" ? "?embed=1" : ""}`;
  }

  return <div className={styles.pageShell}>
    <header className={styles.header}>
      <div>
        <SystemBreadcrumb items={[{ label: "マニュアル", href: "/system/manuals" }, { label: module.name, href: `/system/manuals/${module.slug}` }, { label: manual.name }]} />
        <h1>{manual.name}</h1>
        <p className={styles.lead}>{manual.description}</p>
      </div>
    </header>

    {!docs.length ? (
      <section className={styles.noticeBox}>この資料を読む権限がありません。</section>
    ) : (
      <>
        <div className={styles.tabsRow}>
          <nav className={styles.tabs} aria-label="資料タブ">
            {docs.map((doc) => <Link key={doc.key} href={`/system/manuals/${manual.moduleSlug}/${manual.slug}?tab=${doc.key}`} aria-current={selectedDoc?.key === doc.key ? "page" : undefined}>{doc.label}</Link>)}
          </nav>
          {canManageVersions && selectedDoc && (
            <button type="button" className={styles.replaceButton} onClick={() => setModalOpen(true)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 15v4h14v-4" /></svg>
              この資料を差し替える
            </button>
          )}
        </div>
        <section className={styles.viewerFrame} aria-label={selectedDoc?.label}>
          {selectedDoc?.kind === "md" ? (
            <div className={styles.markdownBody}>
              {markdown.src !== src ? null : markdown.error ? markdown.error : <div dangerouslySetInnerHTML={{ __html: markdown.html }} />}
            </div>
          ) : (
            <iframe
              title={`${manual.name} ${selectedDoc?.label ?? ""}`}
              src={src}
              sandbox="allow-same-origin allow-scripts"
              scrolling="no"
              style={{ height }}
            />
          )}
        </section>
        {canManageVersions && selectedDoc && (
          <section className={styles.versionPanel} aria-labelledby="manual-version-heading">
            <div className={styles.versionHeading}>
              <h2 id="manual-version-heading">版の履歴（この資料）</h2>
              {versions.loading && <span>読み込んでいます</span>}
            </div>
            {versionMessage && <p className={styles.versionMessage}>{versionMessage}</p>}
            <div className={styles.versionList}>
              {versions.current && (
                <div className={styles.versionRow}>
                  <span>{formatDateTime(versions.current.uploaded_at)}　{versions.current.uploaded_by ?? ""}　{formatFileSize(versions.current.size)}</span>
                  <small>いま表示中</small>
                </div>
              )}
              {!versions.loading && !versions.current && versions.versions.length === 0 && <p className={styles.empty}>版の履歴はまだありません</p>}
              {versions.versions.map((version) => (
                <div className={styles.versionRow} key={version.id}>
                  <span>{formatDateTime(version.uploaded_at)}　{version.uploaded_by ?? ""}　{formatFileSize(version.size)}</span>
                  <div>
                    <a href={versionPreviewHref(version)} target="_blank" rel="noreferrer">開く</a>
                    <button type="button" onClick={() => void handleRestore(version)} disabled={busy !== null}>
                      この版に戻す
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {modalOpen && selectedDoc && createPortal(
          <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="manual-replace-heading">
            <div className={styles.modal}>
              <div className={styles.modalHeading}>
                <h2 id="manual-replace-heading">資料を差し替える：{manual.name} ／ {selectedDoc.label}</h2>
                <button type="button" onClick={() => setModalOpen(false)} aria-label="閉じる">×</button>
              </div>
              <p>ここにファイルをドラッグ＆ドロップ（{selectedDoc.kind === "html" ? "html" : "md"}・5MB まで）</p>
              <input
                ref={fileInputRef}
                className={styles.hiddenFileInput}
                type="file"
                accept={selectedDoc.kind === "html" ? ".html" : ".md"}
                onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
              />
              <div
                className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click(); }}
                onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
                onDrop={dropUpload}
              >
                <svg className={styles.uploadIcon} viewBox="0 0 88 104" aria-hidden="true">
                  <path d="M12 3h43l21 21v77H12z" />
                  <path d="M55 3v22h21" />
                  <path d="M29 60h30M44 45v30m0-30L33 56m11-11 11 11" />
                </svg>
                {uploadFile ? (
                  <div className={styles.selectedFile}>
                    <strong>{uploadFile.name}</strong>
                    <span>{formatFileSize(uploadFile.size)}</span>
                    <button type="button" onClick={(event) => { event.stopPropagation(); chooseFile(null); }}>選び直す</button>
                  </div>
                ) : (
                  <>
                    <span>ファイルを選ぶ</span>
                    <small>今の版は「版の履歴」に残ります。</small>
                  </>
                )}
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setModalOpen(false)}>キャンセル</button>
                <button type="button" onClick={() => void handleReplace()} disabled={!uploadFile || busy !== null}>
                  差し替える
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
        <ManualProcessingOverlay open={busy !== null} title={busy === "restore" ? "この版に戻しています…" : "資料を差し替えています…"} />
      </>
    )}
  </div>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFileSize(size: number | null | undefined) {
  if (!size) return "サイズ不明";
  if (size < 1024) return `${size} バイト`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024).toLocaleString("ja-JP")} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function ManualProcessingOverlay({ open, title }: { open: boolean; title: string }) {
  if (!open) return null;
  return createPortal(
    <div className={styles.processingOverlay} role="status" aria-live="assertive" aria-label={title}>
      <div className={styles.processingSpinner} aria-hidden="true" />
      <strong>{title}</strong>
      <span>この画面を閉じないでください</span>
    </div>,
    document.body,
  );
}
