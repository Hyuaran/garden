import { type ReactNode } from "react";
import { type GardenModuleId } from "@/app/_components/layout/GardenShell/garden-shell-config";

export const MODULE_META: Record<GardenModuleId, { color: string; shade: string; role: string }> = {
  bloom: { color: "#f472b6", shade: "#9c0856", role: "案件KPI" },
  fruit: { color: "#fb923c", shade: "#8f4000", role: "法人実績情報" },
  seed: { color: "#facc15", shade: "#7d6400", role: "新規事業" },
  forest: { color: "#34d399", shade: "#146548", role: "全法人決算" },
  bud: { color: "#c084fc", shade: "#5800b1", role: "経理・取引" },
  leaf: { color: "#4ade80", shade: "#137637", role: "案件アプリ" },
  tree: { color: "#a78bfa", shade: "#2f03b0", role: "架電" },
  sprout: { color: "#86efac", shade: "#119b43", role: "採用" },
  soil: { color: "#9aa7b8", shade: "#404c5c", role: "データベース" },
  root: { color: "#5b9dff", shade: "#00409f", role: "組織台帳" },
  rill: { color: "#38bdf8", shade: "#01608a", role: "メッセージ" },
  calendar: { color: "#60a5fa", shade: "#01479e", role: "予定管理" },
};

export function RailIcon({
  color,
  shade,
  children,
  iconScale = 1.85,
  iconStrokeWidth = 1.5,
}: {
  color: string;
  shade: string;
  children: ReactNode;
  iconScale?: number;
  iconStrokeWidth?: number;
}) {
  const gradientId = `rail-icon-gradient-${color.slice(1)}`;
  const shineId = `rail-icon-shine-${color.slice(1)}`;
  return <svg viewBox="0 0 56 56" aria-hidden="true">
    <defs>
      <linearGradient id={gradientId} x1="9" y1="4" x2="47" y2="52" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor={color} />
        <stop offset="1" stopColor={shade} />
      </linearGradient>
      <radialGradient id={shineId} cx="0" cy="0" r="1" gradientTransform="translate(28 14) scale(30 14)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#ffffff" stopOpacity=".55" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x="2" y="2" width="52" height="52" rx="14" fill={`url(#${gradientId})`} stroke="#ffffff" strokeOpacity=".35" strokeWidth="1" />
    <ellipse cx="28" cy="14" rx="30" ry="14" fill={`url(#${shineId})`} />
    <g transform={`translate(28,28) scale(${iconScale}) translate(-12,-12)`} fill="none" stroke="#ffffff" strokeWidth={iconStrokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </g>
  </svg>;
}

export function ModuleIcon({ id }: { id: GardenModuleId }) {
  const icons: Record<GardenModuleId, ReactNode> = {
    bloom: <><circle cx="12" cy="10" r="2.4"/><path d="M12 7.6c0-2 1-3.6 2.5-3.6S17 5.6 17 7.6c2 0 3.6 1 3.6 2.5S19 12.6 17 12.6c0 2-1 3.6-2.5 3.6S12 14.6 12 12.6c-2 0-3.6-1-3.6-2.5S9.9 7.6 12 7.6z"/><path d="M12 16v5"/></>,
    fruit: <><path d="M12 8c-3.5 0-6 2.6-6 6s2.5 7 6 7 6-3.4 6-7-2.5-6-6-6z"/><path d="M12 8V4"/><path d="M12 5c2-.5 3.5-2 3.5-2"/></>,
    seed: <><ellipse cx="12" cy="13" rx="5" ry="6.5"/><path d="M12 19c0-4 1.5-7 4-9"/></>,
    forest: <><path d="M6 20v-3M6 17l-3-3h6zM6 14L4 11h4zM18 20v-3M18 17l-3-3h6zM18 14l-2-3h4zM12 21v-5M12 16l-3.5-4h7z"/></>,
    bud: <><path d="M12 21v-7"/><path d="M12 14c-3 0-5-2.4-5-5.5S9 3 12 3s5 2.4 5 5.5S15 14 12 14z"/></>,
    leaf: <><path d="M5 19c0-8 5-13 14-14 1 9-4 15-12 15-1 0-2 0-2-1z"/><path d="M8 18c2-4 5-7 9-9"/></>,
    tree: <><path d="M12 21v-6M12 15l-5-4h10zM12 11L8 7h8zM12 7l-3-3h6z"/></>,
    sprout: <><path d="M12 21v-8"/><path d="M12 13c0-3 2.2-5 5-5 0 3-2.2 5-5 5z"/><path d="M12 15c0-2.6-2-4.5-4.5-4.5 0 2.6 2 4.5 4.5 4.5z"/></>,
    soil: <><path d="M3 8h18M3 13h18M3 18h18M7 8v10M17 8v10"/></>,
    root: <><path d="M12 3v9M12 12c-1.5 2-4 3-5 6M12 12c1.5 2 4 3 5 6M12 12v9"/></>,
    rill: <><path d="M3 8c3 0 3 2 6 2s3-2 6-2 3 2 6 2M3 13c3 0 3 2 6 2s3-2 6-2 3 2 6 2M3 18c3 0 3 2 6 2"/></>,
    calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>,
  };
  const meta = MODULE_META[id];
  return <RailIcon color={meta.color} shade={meta.shade}>{icons[id]}</RailIcon>;
}
