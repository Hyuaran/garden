/**
 * Garden Series ホーム画面 — v7-D-fix2 (5/5 後道さんデモ用 画像 overlay モード)
 *
 * 経緯:
 *   V7-D で object-fit: cover 全画面表示 → 画面比率により画像 crop で hit area とズレ。
 *   V7-D-fix2 で aspect-ratio 16:9 固定 container + Image fill object-contain に変更、
 *   hit area を同 container 内 % 配置で画像と完全連動。
 *
 * 構成:
 *   - 外枠: cream 背景 + flex center で container を中央配置
 *   - container: aspect-[16/9] max-w-[1920px]、内部に画像 + hit area
 *   - 画像: <Image fill object-contain> で letterbox 維持（crop なし）
 *   - 12 モジュール 透明 hit area: 同 container 内 absolute %
 *
 * 5/5 デモ後（V7-E、post-5/5 dispatch）:
 *   - 404 解消（develop merge or Coming Soon ページ）
 *   - B 案として 12 個別アイコン + CSS 個別実装で動的化
 */

import Image from "next/image";
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
  x: number;        // container 内 left%（中央基準で transform translate -50%）
  y: number;        // container 内 top%（同上）
  href: string;
  label: string;
  minRole: GardenRoleLike;
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

const HIT_WIDTH = 13;   // %
const HIT_HEIGHT = 16;  // %

export default function GardenHomePage() {
  // 5/5 デモ用 super_admin 想定（全 12 module 可視 + click 可）。
  // post-5/5 で root_employees から動的取得 + 各 role に応じて filter。
  const role: GardenRoleLike = "super_admin";
  const visibleHitAreas = HIT_AREAS.filter((h) => isRoleAtLeast(role, h.minRole));

  return (
    <main
      data-testid="home-v7d-fix2"
      style={{
        position: "relative",
        width: "100vw",
        minHeight: "100vh",
        margin: 0,
        padding: 0,
        background: "#FAF8F3",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* aspect-ratio 16/9 固定 container（画像 + hit area が完全連動） */}
      <div
        data-testid="v7d-aspect-container"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 1920,
          aspectRatio: "16 / 9",
        }}
      >
        {/* v4 画像 (object-contain で letterbox 維持、crop なし) */}
        <Image
          src="/images/garden-home-bg-v2.png"
          alt="Garden Series ホーム — 大樹中心の業務 OS ビュー"
          fill
          priority
          sizes="(max-width: 1920px) 100vw, 1920px"
          style={{
            objectFit: "contain",
            objectPosition: "center",
          }}
        />

        {/* 12 モジュール 透明 hit area（同 container 内 % 配置で画像と完全連動） */}
        <div
          data-testid="v4-hit-layer"
          aria-label="Garden 12 モジュール"
          style={{
            position: "absolute",
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
