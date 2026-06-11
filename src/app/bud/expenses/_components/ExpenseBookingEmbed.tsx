"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { ExpenseBookingPanel } from "./ExpenseBookingPanel";

export function ExpenseBookingEmbed() {
  const [el, setEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const tick = () => {
      let node = document.getElementById("exp-booking-mount");
      const tab = document.getElementById("tab-booking");
      if (!node && tab) {
        node = document.createElement("div");
        node.id = "exp-booking-mount";
        const switcher = tab.querySelector(".bud-corp-switch");
        switcher?.insertAdjacentElement("afterend", node);
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
  return createPortal(<ExpenseBookingPanel embedded />, el);
}
