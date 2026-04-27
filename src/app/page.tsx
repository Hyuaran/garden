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

type GardenRoleLike =
  | "outsource" | "toss" | "closer" | "cs" | "staff" | "manager" | "admin" | "super_admin";

const ROLE_RANK: Record<GardenRoleLike, number> = {
  outsource: 0, toss: 1, closer: 2, cs: 3, staff: 4, manager: 5, admin: 6, super_admin: 7,
};

function isRoleAtLeast(role: GardenRoleLike, min: GardenRoleLike): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

type HitArea = {
  key: string;
  x: number;        // 画像内 left%（中央基準で transform translate -50%）
  y: number;        // 画像内 top%（同上）
  href: string;
  label: string;    // aria-label 用「{Garden 正式名} {役割}」
  minRole: GardenRoleLike;  // この role 以上で click 可（disabled 概念は削除）
};

// 12 モジュール 透明 hit area 配置（v7-D-fix で再測定: a-main-009 視覚測定）
// Row 1 樹冠 y=53 / Row 2 地上 y=71 / Row 3 地下 y=88
// hit area サイズ: 13% × 16%
// 全 module を minRole="outsource" でデフォルト全可視（super_admin demo は全 12 件 click 可）
const HIT_AREAS: ReadonlyArray<HitArea> = [
  // Row 1 樹冠（y=53%）
  { key: "bloom",    x: 18, y: 53, href: "/bloom/workboard", label: "Bloom 案件一覧・KPI",          minRole: "outsource" },
  { key: "fruit",    x: 33, y: 53, href: "/fruit",           label: "Fruit 法人実体（番号系・許認可）", minRole: "outsource" },
  { key: "seed",     x: 49, y: 53, href: "/seed",            label: "Seed 新事業",                   minRole: "outsource" },
  { key: "forest",   x: 64, y: 53, href: "/forest",          label: "Forest 全法人決算",             minRole: "outsource" },
  // Row 2 地上（y=71%）
  { key: "bud",      x: 18, y: 71, href: "/bud",             label: "Bud 経理・収支",                minRole: "outsource" },
  { key: "leaf",     x: 33, y: 71, href: "/leaf",            label: "Leaf 個別アプリ・トスアップ",    minRole: "outsource" },
  { key: "tree",     x: 49, y: 71, href: "/tree",            label: "Tree 架電アプリ",               minRole: "outsource" },
  { key: "sprout",   x: 64, y: 71, href: "/sprout",          label: "Sprout 新商材オンボーディング", minRole: "outsource" },
  // Row 3 地下（y=88%）
  { key: "soil",     x: 18, y: 88, href: "/soil",            label: "Soil DB 本体・大量データ基盤",  minRole: "outsource" },
  { key: "root",     x: 33, y: 88, href: "/root",            label: "Root 組織・マスタデータ",       minRole: "outsource" },
  { key: "rill",     x: 49, y: 88, href: "/rill",            label: "Rill Chatwork 連携",           minRole: "outsource" },
  { key: "calendar", x: 64, y: 88, href: "/calendar",        label: "Calendar 時間軸・スケジュール", minRole: "outsource" },
];

const HIT_WIDTH = 13;   // %（旧 11、v7-D-fix で拡大）
const HIT_HEIGHT = 16;  // %（旧 13、v7-D-fix で拡大）

export default function GardenHomePage() {
  // 5/5 デモ用 super_admin 想定（全 12 module 可視 + click 可）。
  // post-5/5 で root_employees から動的取得 + 各 role に応じて filter。
  const role: GardenRoleLike = "super_admin";
  const visibleHitAreas = HIT_AREAS.filter((h) => isRoleAtLeast(role, h.minRole));

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

      {/* 12 モジュール 透明 hit area（v7-D-fix で全 12 件 Link 化） */}
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
        {visibleHitAreas.map((area) => (
          <Link
            key={area.key}
            href={area.href}
            data-module-key={area.key}
            data-testid={`v4-hit-${area.key}`}
            aria-label={area.label}
            title={area.label}
            className="v7d-hit"
            style={{
              position: "absolute",
              left: `${area.x}%`,
              top: `${area.y}%`,
              width: `${HIT_WIDTH}%`,
              height: `${HIT_HEIGHT}%`,
              transform: "translate(-50%, -50%)",
              borderRadius: 14,
              pointerEvents: "auto",
            }}
          />
        ))}
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
