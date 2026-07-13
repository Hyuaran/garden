"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { TransferInboxTray } from "./TransferInboxTray";
import { TransferPaymentCategoryPanel } from "./TransferPaymentCategoryPanel";

export function TransferManagementEmbed() {
  const [listMount, setListMount] = useState<HTMLElement | null>(null);
  const [inboxMount, setInboxMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const tick = () => {
      const nextListMount = document.getElementById("trf-list-mount");
      const nextInboxMount = document.getElementById("trf-inbox-mount");
      if (nextListMount) {
        setListMount((current) =>
          current === nextListMount ? current : nextListMount,
        );
      }
      if (nextInboxMount) {
        setInboxMount((current) =>
          current === nextInboxMount ? current : nextInboxMount,
        );
      }
    };
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 300);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  const updateInboxCount = useCallback((count: number) => {
    const badge = document.getElementById("trf-inbox-tab-badge");
    if (!badge) return;
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }, []);

  return (
    <>
      {listMount && createPortal(<TransferPaymentCategoryPanel />, listMount)}
      {inboxMount &&
        createPortal(
          <TransferInboxTray onCountChange={updateInboxCount} />,
          inboxMount,
        )}
    </>
  );
}
