"use client";

import { useTheme } from "@/app/_lib/theme/ThemeProvider";
import styles from "@/app/system/docs/docs.module.css";

export default function OrientationThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? "ライトにする" : "ダークにする";

  return <button className={styles.presentationThemeToggle} type="button" aria-label={label} onClick={toggleTheme}>
    {theme === "dark" ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4z"/></svg>}
  </button>;
}
