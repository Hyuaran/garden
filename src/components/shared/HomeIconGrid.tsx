"use client";

import Link from "next/link";

type AppDef = { key: string; emoji: string; label: string; href: string; color: string; enabled: boolean };

const APPS: AppDef[] = [
  { key: "soil",   emoji: "🌱", label: "Soil",   href: "/soil",   color: "#8B6F47", enabled: false },
  { key: "root",   emoji: "🌿", label: "Root",   href: "/root",   color: "#5C4332", enabled: true  },
  { key: "tree",   emoji: "🌲", label: "Tree",   href: "/tree",   color: "#3B9B5C", enabled: true  },
  { key: "leaf",   emoji: "🍃", label: "Leaf",   href: "/leaf",   color: "#7FC66D", enabled: false },
  { key: "bud",    emoji: "🌸", label: "Bud",    href: "/bud",    color: "#E07A9B", enabled: false },
  { key: "bloom",  emoji: "🌺", label: "Bloom",  href: "/bloom/workboard", color: "#C3447A", enabled: true },
  { key: "seed",   emoji: "🌰", label: "Seed",   href: "/seed",   color: "#D9BC92", enabled: false },
  { key: "forest", emoji: "🌳", label: "Forest", href: "/forest", color: "#1F5C3A", enabled: true  },
  { key: "rill",   emoji: "🌊", label: "Rill",   href: "/rill",   color: "#4FA8C9", enabled: false },
];

export function HomeIconGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {APPS.map((app) =>
        app.enabled ? (
          <Link
            key={app.key}
            href={app.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              background: "rgba(255,255,255,0.85)",
              borderRadius: 12,
              border: `2px solid ${app.color}`,
              textDecoration: "none",
              color: "#333",
              transition: "transform 0.15s",
            }}
          >
            <div style={{ fontSize: 48 }} aria-hidden>{app.emoji}</div>
            <div style={{ marginTop: 8, fontWeight: 600 }}>{app.label}</div>
          </Link>
        ) : (
          <div
            key={app.key}
            title="準備中"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              background: "rgba(200,200,200,0.4)",
              borderRadius: 12,
              border: "2px solid #ccc",
              opacity: 0.5,
              cursor: "not-allowed",
            }}
            aria-disabled="true"
          >
            <div style={{ fontSize: 48 }} aria-hidden>{app.emoji}</div>
            <div style={{ marginTop: 8 }}>{app.label}</div>
          </div>
        ),
      )}
    </div>
  );
}
