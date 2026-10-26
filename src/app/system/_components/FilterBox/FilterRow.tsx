import type { HTMLAttributes } from "react";
import styles from "./FilterRow.module.css";

export default function FilterRow({ className = "", style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`${styles.row} ${className}`} style={{ ...style, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }} />;
}
