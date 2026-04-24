"use client";

import { useViewModeOptional } from "../../_state/ViewModeContext";
import type { RoadmapEntry } from "../../_types/roadmap-entry";

type Props = {
  banners: RoadmapEntry[];
  simpleView?: boolean;
};

const BANNER_STYLE = {
  critical: { bg: "#dc2626", color: "#fff", icon: "⚠️" },
  warn: { bg: "#f59e0b", color: "#fff", icon: "⚠" },
  info: { bg: "#40916c", color: "#fff", icon: "ℹ️" },
  none: { bg: "#6b7280", color: "#fff", icon: "📣" },
} as const;

export function AnnouncementBanner({ banners, simpleView }: Props) {
  const { simple } = useViewModeOptional();
  const effective = simpleView ?? simple;

  if (banners.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
      {banners.map((b) => {
        const style = BANNER_STYLE[b.banner_severity ?? "none"] ?? BANNER_STYLE.none;
        const label = effective ? b.label_ops ?? b.label_dev : b.label_dev;
        return (
          <div
            key={b.id}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              background: style.bg,
              color: style.color,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 16 }}>{style.icon}</span>
            <span>{label}</span>
            {b.description && (
              <span style={{ fontWeight: 400, opacity: 0.9, marginLeft: 8 }}>
                — {b.description}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
