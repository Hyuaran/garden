"use client";

/**
 * BudFaithfulFrame の注入HTML内（#exp-review-mount）へ ExpenseReviewPanel を差し込むポータル。
 * 注入HTMLは BudGate/認証解決後に現れるため、マウント先が見つかるまで短い間隔でポーリングする。
 */

import { useSystemView } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { ExpenseReviewPanel } from "./ExpenseReviewPanel";

export function ExpenseReviewEmbed() {
  const { allowedTab } = useSystemView();
  const [el, setEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const tick = () => {
      const node = document.getElementById("exp-review-mount");
      hideReviewLegacyBlocks(document.getElementById("tab-submit"));
      if (node) {
        setEl((current) => (current === node ? current : node));
      }
    };
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 300);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  if (!el) return !allowedTab("submit") && (allowedTab("list") || allowedTab("deleted", false)) ? <div hidden><ExpenseReviewPanel embedded /></div> : null;
  return createPortal(<ExpenseReviewPanel embedded />, el);
}

function hideReviewLegacyBlocks(tab: HTMLElement | null) {
  if (!tab) return;
  const blocks = tab.querySelectorAll<HTMLElement>(".exp-sub-summary, .exp-sub-history-card:not([data-exp-status-react])");
  blocks.forEach((block) => block.style.setProperty("display", "none"));
}
