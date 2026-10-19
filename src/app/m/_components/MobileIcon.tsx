import type { ReactNode } from "react";
const paths: Record<string, ReactNode> = {
 folder: <path d="M3 7h7l2 3h9v10H3zM3 7V4h7l2 3h7v3"/>,
    modules: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2zM8 8h8M8 12h8M8 16h5"/></>,
    home: <path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    todo: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/></>,
    news: <><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4"/></>,
    account: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></>,
    moon: <path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4z"/>,
    logout: <path d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/>,
    check: <path d="m5 12 4 4 10-10"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
    left: <path d="m15 5-7 7 7 7"/>, right: <path d="m9 5 7 7-7 7"/>,
    warning: <><path d="m12 3 10 18H2zM12 9v5"/><circle cx="12" cy="17" r=".5"/></>,
};
export function MobileIcon({ name }: {
    name: string;
}) { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>{paths[name]}</svg>; }
