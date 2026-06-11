"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { ExpenseFinalPanel } from "./ExpenseFinalPanel";

export function ExpenseFinalEmbed() {
  const [el, setEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const tick = () => {
      let node = document.getElementById("exp-final-mount");
      const tab = document.getElementById("tab-approve");
      if (!node && tab) {
        node = document.createElement("div");
        node.id = "exp-final-mount";
        const summary = tab.querySelector(".exp-summary-grid");
        summary?.insertAdjacentElement("afterend", node);
      }
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

  if (!el) return null;
  return createPortal(<ExpenseFinalPanel embedded />, el);
}
