"use client";
import type { GardenModule } from "../_constants/module-min-roles";
import styles from "./auth-loading-screen.module.css";
export function AuthLoadingScreen({ module, message }: { module: GardenModule; message: string }) {
  return <div className={styles.screen} data-module={module} role="status"><svg className={styles.spinner} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /></svg><p>{message}</p></div>;
}
