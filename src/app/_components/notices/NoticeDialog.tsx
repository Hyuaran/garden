"use client";
import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import Modal from "@/app/system/_components/Modal/Modal";
export function NoticeDialog({ title, onClose, children, footer }: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer: ReactNode;
}) {
    return createPortal(<Modal title={title} onClose={onClose} actions={footer}>{children}</Modal>, document.body);
}
