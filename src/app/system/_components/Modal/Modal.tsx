"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

let openCount = 0;
let originalOverflow = "";

export type ModalProps = {
  dismissible?: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
  actions?: ReactNode;
  /** 題の右（×の左）に置くもの。例：使い方の［別のタブで開く］ */
  headerActions?: ReactNode;
  className?: string;
};

/** Mount while open. Native modal focus containment also works with nested dialogs. */
export default function Modal({ title, children, onClose, size = "md", actions, headerActions, className, dismissible = true }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    if (openCount++ === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    const input = dialog.querySelector<HTMLElement>(
      'input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled)',
    );
    input?.focus();
    return () => {
      dialog.close();
      if (--openCount === 0) document.body.style.overflow = originalOverflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={ref} className={className} data-garden-modal="panel" data-size={size} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (dismissible) onClose(); }}
    // 閉じられない小窓：Chrome は Esc で cancel を止めきれないことがあるので、キーを止め、閉じられても開き直す。
    onKeyDown={event => { if (!dismissible && event.key === "Escape") event.preventDefault(); }}
    onClose={() => { if (!dismissible && ref.current && !ref.current.open) ref.current.showModal(); }}
    onClick={event => {
      if (!dismissible || event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <header className="garden-modal-heading"><h2 id={titleId}>{title}</h2>{headerActions && <span className="garden-modal-heading-actions">{headerActions}</span>}{dismissible && <button type="button" aria-label="閉じる" onClick={onClose}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>}</header>
    <div className="garden-modal-body">{children}</div>
    {actions && <div data-modal-actions>{actions}</div>}
  </dialog>;
}
