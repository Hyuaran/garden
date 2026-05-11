"use client";

/**
 * Sidebar (Task 2 改訂、2026-05-11)
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 2 §Step 2-4
 *
 * v2.8a Step 3 では 7 generic NAV_ITEMS（href="#" dummy）だったが、
 * Task 2 で「ホーム + 12 module 直リンク + Help カード」構成に置き換え。
 *
 * memory 準拠:
 *   - project_garden_dual_axis_navigation §「staff 以上に集約サイドバー」
 *   - feedback_no_delete_keep_legacy: 旧 7 NAV_ITEMS は `_LEGACY_NAV_ITEMS_V28A_STEP3` として保管（削除禁止）
 *   - project_garden_help_module: Help カード href を `/help` に変更
 *
 * filter: visibleModules prop（plan §Step 2-1 の getVisibleModules(role) 由来）で
 *   モジュール項目を絞り込む。「ホーム」項目は常に表示。
 *
 * active 判定: usePathname() で pathname ベース。
 *   - `/` のとき「ホーム」項目のみ active
 *   - `/bloom/workboard` のとき「Bloom」項目のみ active（href の prefix 一致）
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  iconSrc: string;
  href: string;
  /** 紐づく moduleKey（ホーム項目は undefined）*/
  moduleKey?: string;
};

/**
 * Task 2 新規 NAV_ITEMS: ホーム + 12 module 直リンク
 * 並び順は OrbGrid (DESIGN_SPEC §4-5) と同じ 3 行 4 列レイアウト準拠。
 */
const ALL_NAV_ITEMS: NavItem[] = [
  {
    label: "ホーム",
    iconSrc: "/images/menu_icons/menu_01_home.png",
    href: "/",
  },
  // row 1: 樹冠レイヤー
  {
    label: "Bloom",
    iconSrc: "/images/icons/bloom.png",
    href: "/bloom/workboard",
    moduleKey: "Bloom",
  },
  {
    label: "Fruit",
    iconSrc: "/images/icons/fruit.png",
    href: "/fruit",
    moduleKey: "Fruit",
  },
  {
    label: "Seed",
    iconSrc: "/images/icons/seed.png",
    href: "/seed",
    moduleKey: "Seed",
  },
  {
    label: "Forest",
    iconSrc: "/images/icons/forest.png",
    href: "/forest",
    moduleKey: "Forest",
  },
  // row 2: 地上レイヤー
  {
    label: "Bud",
    iconSrc: "/images/icons/bud.png",
    href: "/bud",
    moduleKey: "Bud",
  },
  {
    label: "Leaf",
    iconSrc: "/images/icons/leaf.png",
    href: "/leaf",
    moduleKey: "Leaf",
  },
  {
    label: "Tree",
    iconSrc: "/images/icons/tree.png",
    href: "/tree",
    moduleKey: "Tree",
  },
  {
    label: "Sprout",
    iconSrc: "/images/icons/sprout.png",
    href: "/sprout",
    moduleKey: "Sprout",
  },
  // row 3: 地下レイヤー
  {
    label: "Soil",
    iconSrc: "/images/icons/soil.png",
    href: "/soil",
    moduleKey: "Soil",
  },
  {
    label: "Root",
    iconSrc: "/images/icons/root.png",
    href: "/root",
    moduleKey: "Root",
  },
  {
    label: "Rill",
    iconSrc: "/images/icons/rill.png",
    href: "/rill",
    moduleKey: "Rill",
  },
  {
    label: "Calendar",
    iconSrc: "/images/icons/calendar.png",
    href: "/calendar",
    moduleKey: "Calendar",
  },
];

/**
 * 旧 v2.8a Step 3 generic 7 NAV_ITEMS。
 * memory feedback_no_delete_keep_legacy.md 準拠で削除せず保管。
 * 未使用（参照されない）が、過去設計の参照用に残置。
 */
const _LEGACY_NAV_ITEMS_V28A_STEP3: NavItem[] = [
  { label: "ホーム", iconSrc: "/images/menu_icons/menu_01_home.png", href: "/" },
  { label: "ダッシュボード", iconSrc: "/images/menu_icons/menu_02_dashboard.png", href: "#" },
  { label: "取引", iconSrc: "/images/menu_icons/menu_03_transactions.png", href: "#" },
  { label: "顧客", iconSrc: "/images/menu_icons/menu_04_customers.png", href: "#" },
  { label: "ワークフロー", iconSrc: "/images/menu_icons/menu_05_workflow.png", href: "#" },
  { label: "レポート", iconSrc: "/images/menu_icons/menu_06_reports.png", href: "#" },
  { label: "設定", iconSrc: "/images/menu_icons/menu_07_settings.png", href: "#" },
];
// 未使用警告抑止（残置目的）
void _LEGACY_NAV_ITEMS_V28A_STEP3;

type Props = {
  /**
   * 可視 module key の許可リスト（plan §Step 2-1 の getVisibleModules(role) 由来）。
   * 未指定時は全 module 項目を表示（後方互換）。
   * 「ホーム」項目は常に表示。
   */
  visibleModules?: readonly string[];
};

/** href がホームページかどうか */
function isHomeHref(href: string): boolean {
  return href === "/";
}

/**
 * 現在 pathname が NavItem の href とマッチするか判定。
 *
 * - href === "/": pathname も "/" のときだけ active（root 厳密一致）
 * - それ以外: pathname が href または href+"/..." で始まる場合に active
 */
function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (isHomeHref(href)) return pathname === "/";
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

export default function Sidebar({ visibleModules }: Props = {}) {
  const pathname = usePathname();

  const items = visibleModules
    ? ALL_NAV_ITEMS.filter(
        (item) =>
          // ホーム項目（moduleKey undefined）は常に表示
          !item.moduleKey || visibleModules.includes(item.moduleKey),
      )
    : ALL_NAV_ITEMS;

  return (
    <aside className="sidebar">
      <nav className="nav-menu">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`nav-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="nav-icon">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.iconSrc} alt="" />
              </span>
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ===== Help & Tips カード ===== */}
      <Link
        href="/help"
        className="help-card"
        title="Gardenシリーズの使い方"
      >
        <div className="help-card-leaf">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2 C8 6, 5 10, 6 16 C10 17, 14 14, 17 10 C16 6, 14 3, 12 2 Z"
              fill="currentColor"
              opacity="0.85"
            />
            <path
              d="M12 2 C12 8, 10 13, 6 16"
              stroke="currentColor"
              strokeWidth="0.5"
              fill="none"
              opacity="0.5"
            />
          </svg>
        </div>
        <div className="help-card-text">
          <strong>Help &amp; Tips</strong>
          <span>使い方ガイド</span>
        </div>
        <span className="help-card-arrow">›</span>
      </Link>
    </aside>
  );
}
