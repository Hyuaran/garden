"use client";

import type { ReactNode } from "react";
import type { RootMenuIconName } from "../_constants/types";
import rootStyles from "./root-shell.module.css";

export function RootMenuIcon({ icon, className }: { icon: RootMenuIconName; className?: string }) {
  const icons: Record<RootMenuIconName, ReactNode> = {
    home: <path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
    inbox: <><path d="M4 13h4l2 3h4l2-3h4" /><path d="M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" /><path d="M12 3v10" /><path d="m8 9 4 4 4-4" /></>,
    document: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" /><path d="M9 13h6M9 17h4" /></>,
    building: <><rect x="4" y="4" width="16" height="17" rx="1.5" /><path d="M8 8h2M14 8h2M8 12h2M14 12h2M8 16h2M14 16h2M10 21v-3h4v3" /></>,
    bank: <><path d="M3 9h18L12 4z" /><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" /></>,
    partner: <><circle cx="7.5" cy="8" r="3" /><circle cx="16.5" cy="8" r="3" /><path d="M3.5 20c0-3 1.8-5 4-5s4 2 4 5" /><path d="M12.5 20c0-3 1.8-5 4-5s4 2 4 5" /><path d="M10 12.5h4" /></>,
    person: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></>,
    check: <><circle cx="10" cy="10" r="6" /><path d="m14.5 14.5 5 5" /><path d="m7.5 10 1.8 1.8 3.7-4" /></>,
    key: <><circle cx="8" cy="12" r="4" /><path d="M12 12h9M17 12v3M20 12v3" /></>,
    salary: <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
    shield: <><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
    sync: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M18.2 12A6.5 6.5 0 0 0 7 7.4L4 12" /><path d="M5.8 12A6.5 6.5 0 0 0 17 16.6l3-4.6" /></>,
  };
  return <svg className={`${rootStyles.menuIcon} ${className ?? ""}`} viewBox="0 0 24 24" aria-hidden="true">{icons[icon]}</svg>;
}
