"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import type {
  GardenShellActivityItem,
  GardenShellPageMenuItem,
} from "@/app/_components/layout/GardenShell/garden-shell-config";
import { ThemeProvider } from "@/app/_lib/theme/ThemeProvider";

import { fmtDateJP } from "../_lib/format";
import { useForestState } from "../_state/ForestStateContext";

const FOREST_PAGE_MENU_BASE: GardenShellPageMenuItem[] = [
  { href: "/forest/dashboard", label: "\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9", icon: "\ud83d\udcca" },
  { href: "/forest/shinkouki", label: "\u9032\u884c\u671f\u306e\u66f4\u65b0", icon: "\ud83c\udf3f" },
  { href: "/forest/financial-statements", label: "\u6c7a\u7b97\u66f8", icon: "\ud83d\udcc4" },
  { href: "/forest/company-overview", label: "\u4f1a\u793e\u6982\u8981", icon: "\ud83c\udfe2" },
  { href: "/forest/reports", label: "\u30ec\u30dd\u30fc\u30c8\u5206\u6790", icon: "\ud83d\udcdd" },
  { href: "/forest/registration-change", label: "\u767b\u8a18\u5909\u66f4", icon: "\ud83c\udf31" },
];

function isActiveMenu(pathname: string, href: string): boolean {
  if (href === "/forest/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ForestShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const isLoginPage = pathname === "/forest/login" || pathname === "/forest";
  const { isUnlocked, userEmail, lockAndLogout, lastUpdated } = useForestState();

  if (isLoginPage || !isUnlocked) {
    return <>{children}</>;
  }

  const updateText = `\u6700\u7d42\u66f4\u65b0: ${fmtDateJP(lastUpdated?.at ?? null)}`;
  const activeMenu = FOREST_PAGE_MENU_BASE.map((item) => ({
    ...item,
    active: isActiveMenu(pathname, item.href),
  }));
  const activityItems: GardenShellActivityItem[] = [
    {
      time: "11:30",
      icon: "/themes/garden-shell/images/icons_bloom/orb_forest.png",
      title: "Forest dashboard refreshed",
      body: "\u6700\u65b0\u306e\u66f4\u65b0\u60c5\u5831\u3092\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9\u4e0a\u90e8\u306b\u8868\u793a\u3057\u3066\u3044\u307e\u3059\u3002",
    },
    {
      time: "10:45",
      icon: "/themes/garden-shell/images/icons_bloom/bloom_ceostatus.png",
      title: "6\u6cd5\u4eba\u30de\u30c8\u30ea\u30af\u30b9",
      body: "\u6cd5\u4eba\u5225\u30fb\u5e74\u5ea6\u5225\u306e\u78ba\u5b9a\u671f\u3068\u9032\u884c\u671f\u3092\u540c\u3058\u5165\u53e3\u3067\u78ba\u8a8d\u3067\u304d\u307e\u3059\u3002",
    },
    {
      time: "10:12",
      icon: "/themes/garden-shell/images/icons_bloom/bloom_workboard.png",
      title: "\u9032\u884c\u671f\u306e\u66f4\u65b0",
      body: "\u6570\u5024\u66f4\u65b0\u30fb\u671f\u7e70\u308a\u30fb\u4fdd\u5b58\u5c0e\u7dda\u306f Codex-060 \u306e\u5b9f\u88c5\u3092\u7dad\u6301\u3057\u3066\u3044\u307e\u3059\u3002",
    },
    {
      time: "09:48",
      icon: "/themes/garden-shell/images/icons_bloom/orb_root.png",
      title: "\u8a8d\u8a3c\u7d71\u5408",
      body: "Forest \u6a29\u9650\u30c1\u30a7\u30c3\u30af\u306f Garden \u306e\u30ed\u30b0\u30a4\u30f3\u30bb\u30c3\u30b7\u30e7\u30f3\u3092\u7dad\u6301\u3057\u307e\u3059\u3002",
    },
  ];

  return (
    <ThemeProvider>
      <GardenShell
        activeModule="forest"
        pageMenu={activeMenu}
        activityItems={activityItems}
        moduleName="Forest"
        moduleIcon="/themes/garden-shell/images/icons_bloom/orb_forest.png"
        bgLight="../../../images/backgrounds/bg-forest-light.webp"
        bgDark="../../../images/backgrounds/bg-forest-dark.webp"
        userName={userEmail ?? "Garden Forest"}
        userEmail={userEmail}
        userRoleLabel="Forest"
        onLogout={() => lockAndLogout("manual")}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", margin: "-6px 0 14px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid rgba(149,213,178,0.55)",
              borderRadius: 999,
              background: "rgba(255,255,255,0.66)",
              color: "#2d6a4f",
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 14px",
              boxShadow: "0 12px 28px rgba(27,67,50,0.08)",
              backdropFilter: "blur(12px)",
            }}
          >
            {updateText}
          </span>
        </div>
        {children}
      </GardenShell>
    </ThemeProvider>
  );
}
