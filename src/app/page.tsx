/**
 * Garden Series ホーム画面 — v7-D A 案（5/5 後道さんデモ用 画像 overlay モード）
 *
 * 経緯:
 *   東海林さんが ChatGPT で完璧な理想画面（v4）を生成 → public/images/garden-home-bg-v2.png に
 *   v4 内容で上書き済。dispatch v7-D（2026-04-27）で「全く同じ」を最速実現する A 案採用。
 *
 * 構成:
 *   - 画像全画面（width 100vw / height 100vh / object-fit cover / position fixed）
 *   - 12 モジュール 透明 hit area（画像内位置に absolute 配置、hover で scale + ring）
 *   - 既存 Sidebar / AppHeader / KpiCard / TodaysActivity / ModuleGrid は本ファイルでは未使用
 *     （CLAUDE.md ファイル削除禁止 + B 案で再利用するため component 自体は残置）
 *
 * 5/5 デモ後（V7-E、post-5/5 dispatch）:
 *   - B 案として 12 個別アイコン + CSS 個別実装で動的化
 *   - KPI / Today's Activity / Sidebar / AppHeader を画像準拠で CSS 再現
 *   - 動的データ（実 user 名、実 KPI、実通知）反映
 */

import Link from "next/link";

export const dynamic = "force-dynamic";

type HitArea = {
  key: string;
  x: number;        // 画像内 left%（中央基準で transform translate -50%）
  y: number;        // 画像内 top%（同上）
  href: string;
  label: string;    // aria-label 用「{Garden 正式名} {役割}」
  enabled: boolean; // 8-role aware: false の場合は disabled 表示（cursor: not-allowed）
};

// 12 モジュール 透明 hit area 配置（dispatch v7-D 概算座標、東海林さん localhost 確認後微調整想定）
// Row 1 樹冠 y=43 / Row 2 地上 y=58 / Row 3 地下 y=73
// hit area サイズ: 11% × 13%
const HIT_AREAS: ReadonlyArray<HitArea> = [
  // Row 1 樹冠（y=43%）
  { key: "bloom",    x: 23, y: 43, href: "/bloom/workboard", label: "Bloom 案件一覧・KPI",          enabled: true },
  { key: "fruit",    x: 37, y: 43, href: "/fruit",           label: "Fruit 法人実体（番号系・許認可）", enabled: false },
  { key: "seed",     x: 51, y: 43, href: "/seed",            label: "Seed 新事業",                   enabled: false },
  { key: "forest",   x: 65, y: 43, href: "/forest",          label: "Forest 全法人決算",             enabled: true  },
  // Row 2 地上（y=58%）
  { key: "bud",      x: 23, y: 58, href: "/bud",             label: "Bud 経理・収支",                enabled: false },
  { key: "leaf",     x: 37, y: 58, href: "/leaf",            label: "Leaf 個別アプリ・トスアップ",    enabled: false },
  { key: "tree",     x: 51, y: 58, href: "/tree",            label: "Tree 架電アプリ",               enabled: true  },
  { key: "sprout",   x: 65, y: 58, href: "/sprout",          label: "Sprout 新商材オンボーディング", enabled: false },
  // Row 3 地下（y=73%）
  { key: "soil",     x: 23, y: 73, href: "/soil",            label: "Soil DB 本体・大量データ基盤",  enabled: false },
  { key: "root",     x: 37, y: 73, href: "/root",            label: "Root 組織・マスタデータ",       enabled: true  },
  { key: "rill",     x: 51, y: 73, href: "/rill",            label: "Rill Chatwork 連携",           enabled: false },
  { key: "calendar", x: 65, y: 73, href: "/calendar",        label: "Calendar 時間軸・スケジュール", enabled: false },
];

const HIT_WIDTH = 11;   // %
const HIT_HEIGHT = 13;  // %

export default function GardenHomePage() {
  return (
    <main
      data-testid="home-v7d"
      style={{
        position: "relative",
        width: "100vw",
        minHeight: "100vh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* v4 画像 全画面（fixed cover） */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          backgroundImage: "url(/images/garden-home-bg-v2.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* 12 モジュール 透明 hit area */}
      <div
        data-testid="v4-hit-layer"
        aria-label="Garden 12 モジュール"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
        }}
      >
        {HIT_AREAS.map((area) => {
          const baseStyle: React.CSSProperties = {
            position: "absolute",
            left: `${area.x}%`,
            top: `${area.y}%`,
            width: `${HIT_WIDTH}%`,
            height: `${HIT_HEIGHT}%`,
            transform: "translate(-50%, -50%)",
            borderRadius: 14,
            pointerEvents: "auto",
          };
          if (!area.enabled) {
            return (
              <div
                key={area.key}
                data-module-key={area.key}
                aria-disabled="true"
                aria-label={`${area.label} — 準備中`}
                title={`${area.label} — 準備中`}
                className="v7d-hit v7d-hit--disabled"
                style={{ ...baseStyle, cursor: "not-allowed" }}
              />
            );
          }
          return (
            <Link
              key={area.key}
              href={area.href}
              data-module-key={area.key}
              data-testid={`v4-hit-${area.key}`}
              aria-label={area.label}
              title={area.label}
              className="v7d-hit"
              style={baseStyle}
            />
          );
        })}
      </div>

      {/* 隠し search input（Ctrl+F focus 用、v6 AppHeader 機能の最小代替）*/}
      <input
        type="text"
        aria-label="検索（暫定 placeholder、v7-E で再有効化）"
        data-testid="v7d-hidden-search"
        style={{
          position: "fixed",
          left: -9999,
          top: -9999,
          width: 1,
          height: 1,
          opacity: 0,
        }}
      />
    </main>
  );
}
