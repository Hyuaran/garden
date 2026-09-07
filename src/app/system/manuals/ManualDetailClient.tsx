"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import type { ManualDefinition, ManualDoc, ManualModule } from "./_lib/manuals-registry";
import { renderMarkdown } from "./_lib/render-markdown";
import styles from "./manuals.module.css";

export default function ManualDetailClient({
  module,
  manual,
  docs,
  selectedDoc,
}: {
  module: ManualModule;
  manual: ManualDefinition;
  docs: ManualDoc[];
  selectedDoc?: ManualDoc;
}) {
  const [height, setHeight] = useState(600);
  const [markdown, setMarkdown] = useState({ src: "", html: "", error: "" });
  const src = useMemo(() => {
    if (!selectedDoc) return "";
    const base = `/api/system/manuals/${manual.moduleSlug}/${manual.slug}/${selectedDoc.file}`;
    return selectedDoc.kind === "html" ? `${base}?embed=1` : base;
  }, [manual.moduleSlug, manual.slug, selectedDoc]);

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
        <nav className={styles.tabs} aria-label="資料タブ">
          {docs.map((doc) => <Link key={doc.key} href={`/system/manuals/${manual.moduleSlug}/${manual.slug}?tab=${doc.key}`} aria-current={selectedDoc?.key === doc.key ? "page" : undefined}>{doc.label}</Link>)}
        </nav>
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
      </>
    )}
  </div>;
}
