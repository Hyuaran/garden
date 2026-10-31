"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Modal from "../Modal/Modal";
import { TabActionButton } from "../SystemTabs/SystemTabs";
import { findManualForPath, type ManualDefinition } from "../../manuals/_lib/manuals-registry";
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
    {opened && <Modal size="lg" title={`${opened.name}の使い方`} onClose={() => setOpened(null)} actions={<button type="button" onClick={() => setOpened(null)}>閉じる</button>}>
      <p><a href={`/system/manuals/${opened.moduleSlug}/${opened.slug}?tab=operation`} target="_blank" rel="noreferrer">別のタブで開く</a></p>
      <HelpDocument key={`${opened.moduleSlug}/${opened.slug}`} manual={opened} />
    </Modal>}
  </span>;
}

function HelpDocument({ manual }: { manual: ManualDefinition }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);
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
    if (doc) setHeight(Math.max(600, doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0));
  }} />;
}
