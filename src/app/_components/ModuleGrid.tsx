"use client";

/**
 * Garden 12 モジュール 3×4 グリッド（v6 dispatch Step 5、5/5 後道さんデモ用 dashboard layout）
 *
 * 配置: CLAUDE.md 1-12 順 + project_garden_3layer_visual_model 縦階層に基づく行配置
 *   Row 1 樹冠: Bloom / Fruit / Seed / Forest
 *   Row 2 地上: Bud / Leaf / Tree / Sprout
 *   Row 3 地下: Soil / Root / Rill / Calendar
 *
 * 既存 ModuleSlot / ModuleLayer の bonsai 中心 circular 配置を置換。
 * 各カードは disabled でもクリック可能ではないが visual で「準備中」表示。
 * 動的バッジ（未処理件数 等）は 5/5 デモまでモック値、post-5/5 で各モジュール API 連携。
 */

import Link from "next/link";
import { MODULES, type ModuleKey } from "../../components/shared/garden-view/_lib/modules";

// v6 grid 専用順序（modules.ts MODULE_KEYS とは別、レイヤー別行配置）
const MODULE_GRID_ORDER: ModuleKey[] = [
  // Row 1 樹冠
  "bloom", "fruit", "seed", "forest",
  // Row 2 地上
  "bud", "leaf", "tree", "sprout",
  // Row 3 地下
  "soil", "root", "rill", "calendar",
];

// 5/5 デモ用モック動的バッジ（post-5/5 で各モジュール API から取得）
const MOCK_BADGES: Partial<Record<ModuleKey, string>> = {
  bud: "未処理仕訳: 12件",
  bloom: "新規 KPI: 3件",
  tree: "架電予定: 15件",
  forest: "未確認: 2件",
  root: "未処理タスク: 4件",
};

export function ModuleGrid() {
  return (
    <section
      aria-label="Garden 12 モジュール"
      data-testid="module-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
        maxWidth: 1080,
        margin: "0 auto",
      }}
    >
      {MODULE_GRID_ORDER.map((key) => {
        const m = MODULES[key];
        const badge = MOCK_BADGES[key];
        const innerStyle = {
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          aspectRatio: "1 / 1",
          padding: 16,
          borderRadius: 16,
          background: "rgba(255, 255, 255, 0.86)",
          backdropFilter: "blur(6px)",
          border: m.enabled ? `2px solid ${m.color}` : "2px solid #c8c8c8",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
          color: m.enabled ? "#2B2B2B" : "#888",
          opacity: m.enabled ? 1 : 0.55,
          transition: "transform 0.2s ease-out, box-shadow 0.2s ease-out",
        } as const;

        const innerContent = (
          <>
            <img
              src={`/themes/module-icons/${key}.webp`}
              alt=""
              aria-hidden
              width={64}
              height={64}
              style={{
                display: "block",
                objectFit: "contain",
                filter: m.enabled ? "none" : "grayscale(0.6)",
              }}
            />
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: 10, color: m.enabled ? "#5C6E5F" : "#888", marginTop: 2 }}>
                {m.description}
              </div>
            </div>
            {badge && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  fontWeight: 600,
                  color: m.enabled ? m.color : "#888",
                  background: m.enabled ? `${m.color}1A` : "#EEE",
                  padding: "3px 8px",
                  borderRadius: 12,
                }}
              >
                {badge}
              </div>
            )}
          </>
        );

        if (m.enabled) {
          return (
            <Link
              key={key}
              href={m.href}
              data-testid={`module-card-${key}`}
              data-module-key={key}
              className="gv-grid-card"
              style={{ textDecoration: "none" }}
            >
              <div style={innerStyle} className="gv-grid-card-inner">
                {innerContent}
              </div>
            </Link>
          );
        }

        return (
          <div
            key={key}
            data-testid={`module-card-${key}`}
            data-module-key={key}
            aria-disabled="true"
            title={`${m.label}（${m.layer}） — 準備中`}
            style={innerStyle}
          >
            {innerContent}
          </div>
        );
      })}
    </section>
  );
}
