"use client";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import type { GardenShellPageMenuItem } from "@/app/_components/layout/GardenShell/garden-shell-config";
import { signOutUnified, useAuthUnified } from "@/app/_lib/auth-unified";

const LEAF_ICON = "/themes/garden-shell/images/icons_bloom/orb_leaf.png";

const ACTIVITY_ITEMS = [
  {
    time: "11:40",
    icon: LEAF_ICON,
    title: "Leaf 入口を整備",
    body: "事業部カードから利用可能なプロトタイプへ進めるようにしています。",
  },
  {
    time: "10:25",
    icon: LEAF_ICON,
    title: "関電プロトタイプ閲覧",
    body: "入力UIと事務UIを Garden Shell の中で確認できる状態にしました。",
  },
  {
    time: "09:50",
    icon: "/themes/garden-shell/images/icons_bloom/orb_root.png",
    title: "本実装の次段階",
    body: "プロトタイプ確認後、Root 連携と各事業部画面を順に設計します。",
  },
];

type LeafActivePage = "overview" | "kanden-input" | "kanden-backoffice";

function roleLabel(role: string | null): string {
  if (role === "super_admin") return "全権管理";
  if (role === "admin") return "管理";
  if (role === "manager") return "マネージャー";
  if (role === "staff") return "スタッフ";
  return "Garden Leaf";
}

export function leafPageMenu(active: LeafActivePage): GardenShellPageMenuItem[] {
  return [
    { href: "/leaf", label: "Overview", icon: "諺", active: active === "overview" },
    { href: "/leaf/kanden/input", label: "関電・入力", icon: "鴻", active: active === "kanden-input" },
    {
      href: "/leaf/kanden/backoffice",
      label: "関電・事務",
      icon: "鴻",
      active: active === "kanden-backoffice",
    },
  ];
}

export default function LeafShell({
  active,
  children,
}: {
  active: LeafActivePage;
  children: React.ReactNode;
}) {
  const { role, employeeNumber } = useAuthUnified();
  const userName = employeeNumber ? `社員 ${employeeNumber}` : "Garden Leaf";

  return (
    <GardenShell
      activeModule="leaf"
      pageMenu={leafPageMenu(active)}
      activityItems={ACTIVITY_ITEMS}
      userName={userName}
      userEmail={null}
      userRoleLabel={roleLabel(role)}
      onLogout={() => signOutUnified()}
    >
      {children}
    </GardenShell>
  );
}
