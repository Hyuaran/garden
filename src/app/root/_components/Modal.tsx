"use client";

import { type ReactNode, useEffect, useRef } from "react";
import GardenModal from "@/app/system/_components/Modal/Modal";

export function Modal({ open, onClose, onSubmit, title, children, width = 640 }: {
  open: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !onSubmit) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== "Enter" || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      if (target && ["TEXTAREA", "BUTTON", "SELECT"].includes(target.tagName)) return;
      // 小窓を重ねたときは、一番手前の小窓だけが Enter を受ける（後ろの編集を保存しない）
      const dialogs = document.querySelectorAll("dialog[open]");
      if (dialogs.length && bodyRef.current?.closest("dialog") !== dialogs[dialogs.length - 1]) return;
      event.preventDefault();
      onSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onSubmit]);
  if (!open) return null;
  return <GardenModal title={title} onClose={onClose} size={width <= 520 ? "sm" : width >= 800 ? "lg" : "md"}><div ref={bodyRef} style={{ display: "contents" }}>{children}</div></GardenModal>;
}
