"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./notices.module.css";
export function NoticeDialog({ title, onClose, children, footer }: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { const previous = document.activeElement as HTMLElement | null; const dialog = ref.current; dialog?.showModal(); const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); }; }, []);
    return createPortal(<dialog ref={ref} className={styles.dialog} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) {
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            onClose();
    } }}><div className={styles.dialogInner}><header className={styles.header}><h2>{title}</h2><button autoFocus aria-label="閉じる" onClick={onClose}>×</button></header><div className={styles.content}>{children}</div><footer className={styles.footer}>{footer}</footer></div></dialog>, document.body);
}
