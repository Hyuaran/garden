"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { ExpenseDonePanel } from "./ExpenseDonePanel";

// 完了タブは埋め込みHTML側に存在しないため、タブボタンと中身の入れ物をこちらから差し込む。
// ★埋め込みHTMLは後から描き直されて差し込んだ要素が消えることがあるので、
//   ExpenseBookingEmbed と同じく setInterval で常に確かめて入れ直す（1回きりの再試行にしない）。
export function ExpenseDoneEmbed() {
  const [el, setEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const tick = () => {
      const nav = document.querySelector<HTMLElement>(".tab-nav");
      const bookingButton = nav?.querySelector<HTMLButtonElement>('[data-tab="booking"]');
      const bookingTab = document.getElementById("tab-booking");
      if (!nav || !bookingButton || !bookingTab) return;

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
        bookingTab.insertAdjacentElement("afterend", tab);
      }
      setEl((current) => (current === tab ? current : tab));
    };
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 300);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  if (!el) return null;
  return createPortal(<ExpenseDonePanel />, el);
}
