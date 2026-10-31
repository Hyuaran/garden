import type { ButtonHTMLAttributes } from "react";
import styles from "./row-action-button.module.css";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label" | "title"> & {
  kind: "edit" | "delete";
  label?: string;
};

/** 1 件に対する編集・削除。操作名は読み上げとツールチップで伝える。 */
export default function RowActionButton({ kind, label = kind === "edit" ? "編集" : "削除", className, type = "button", ...props }: Props) {
  return <button {...props} type={type} className={[styles.button, kind === "delete" ? styles.danger : "", className].filter(Boolean).join(" ")} aria-label={label} title={label}>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {kind === "edit" ? <><path d="M4 20l1-5L16 4l4 4L9 19l-5 1z" /><path d="M14 6l4 4" /></> : <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>}
    </svg>
  </button>;
}
