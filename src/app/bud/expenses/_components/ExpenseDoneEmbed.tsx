"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExpenseDonePanel } from "./ExpenseDonePanel";

export function ExpenseDoneEmbed() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".bud-page .tab-nav");
    const bookingButton = nav?.querySelector<HTMLButtonElement>('[data-tab="booking"]');
    if (!nav || !bookingButton) return;
    let button = nav.querySelector<HTMLButtonElement>('[data-tab="done"]');
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "tab-item";
      button.dataset.tab = "done";
      button.innerHTML = '<span class="tab-item-jp">完了</span>/ Done';
      bookingButton.insertAdjacentElement("afterend", button);
    }
    let tab = document.getElementById("tab-done");
    if (!tab) {
      tab = document.createElement("div");
      tab.className = "tab-content";
      tab.id = "tab-done";
      document.getElementById("tab-booking")?.insertAdjacentElement("afterend", tab);
    }
    setHost(tab);
  }, []);
  return host ? createPortal(<ExpenseDonePanel />, host) : null;
}
