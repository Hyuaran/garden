"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Modal from "../Modal/Modal";
import { TabActionButton } from "../SystemTabs/SystemTabs";
import { findManualForPath, type ManualDefinition } from "../../manuals/_lib/manuals-registry";
import { applyGardenTheme, useGardenThemeSync } from "../../manuals/_lib/doc-theme";
import styles from "./help-button.module.css";

export default function HelpButton() {
  return <Suspense fallback={<UnavailableHelp />}><RouteHelp /></Suspense>;
}

function UnavailableHelp() {
  return <TabActionButton icon="help" label="この画面の使い方" title="この画面の使い方" disabled disabledReason="この画面の使い方は準備中です" />;
}

function RouteHelp() {
  const pathname = usePathname();
  const search = useSearchParams();
  const manual = findManualForPath(`${pathname ?? ""}?${search?.toString() ?? ""}`);
  const [opened, setOpened] = useState<ManualDefinition | null>(null);
  return <span className={styles.help} data-garden-help>
    {manual ? <TabActionButton icon="help" label="この画面の使い方" onClick={() => setOpened(manual)} /> : <UnavailableHelp />}
    {/* 題・別のタブで開く・× は上に固定し、下の［閉じる］は置かない（東海林さん 2026-10-31） */}
    {opened && <Modal size="lg" className={styles.dialog} title={`${opened.name}の使い方`} onClose={() => setOpened(null)} headerActions={<a className={styles.newTab} href={`/system/manuals/${opened.moduleSlug}/${opened.slug}?tab=operation`} target="_blank" rel="noreferrer">別のタブで開く<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg></a>}>
      <HelpDocument key={`${opened.moduleSlug}/${opened.slug}`} manual={opened} />
    </Modal>}
  </span>;
}

function HelpDocument({ manual }: { manual: ManualDefinition }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);
  const getDoc = useCallback(() => ref.current?.contentDocument, []);
  useGardenThemeSync(getDoc);
  const src = `/api/system/manuals/${manual.moduleSlug}/${manual.slug}/1_operation.html?embed=1`;
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== ref.current?.contentWindow || event.origin !== window.location.origin) return;
      const next = event.data?.__docHeight;
      if (typeof next === "number" && Number.isFinite(next) && next > 0) setHeight(Math.max(600, Math.ceil(next)));
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  return <iframe ref={ref} className={styles.document} title={`${manual.name} 使い方`} src={src} sandbox="allow-same-origin allow-scripts" scrolling="no" style={{ height }} onLoad={() => {
    const doc = ref.current?.contentDocument;
    if (!doc) return;
    // 小窓の中では、資料の場所の表示と大きい題は出さない（小窓の題と二重になる）。
    // 背景は小窓と同じ色（透明）にし、明暗は Garden の切り替えに合わせる（資料は :root[data-theme] で色が変わる）
    applyGardenTheme(doc);
    if (!doc.getElementById("garden-help-embed")) {
      const style = doc.createElement("style");
      style.id = "garden-help-embed";
      style.textContent = ".crumb{display:none!important}body h1:first-of-type{display:none!important}:root{--bg:transparent!important}html,body{background:transparent!important}";
      doc.head.appendChild(style);
    }
    setHeight(Math.max(600, doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0));
  }} />;
}
