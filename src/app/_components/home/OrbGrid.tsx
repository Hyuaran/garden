/**
 * OrbGrid (v2.8a Step 5 — 動的版)
 *
 * DESIGN_SPEC §4-5
 *
 * 12 ガラス玉モジュール grid (4 列 × 3 行)
 *
 * モジュール並び順 (v2.8a プロトタイプ準拠):
 *   row 1: Bloom / Fruit / Seed / Forest    (樹冠レイヤー)
 *   row 2: Bud / Leaf / Tree / Sprout       (地上レイヤー)
 *   row 3: Soil / Root / Rill / Calendar    (地下レイヤー)
 *
 * href:
 *   既存 routes に合わせて、未実装モジュールは Coming Soon ページへ
 *   (V7-D-fix と同じ運用)
 *
 * Step 5: hover/click callback を全 OrbCard に forward (音再生用)
 */
import OrbCard, { type OrbStatusTone } from "./OrbCard";

type ModuleDef = {
  moduleKey: string;
  iconSrc: string;
  label: string;
  description: string;
  statusLabel: string;
  statusValue: string;
  statusTone?: OrbStatusTone;
  href: string;
};

const MODULES: ModuleDef[] = [
  // ===== row 1: 樹冠レイヤー =====
  {
    moduleKey: "Bloom",
    iconSrc: "/images/icons/bloom.png",
    label: "Bloom",
    description: "案件一覧・日報・KPI",
    statusLabel: "レポート更新",
    statusValue: "3 件",
    href: "/bloom/workboard",
  },
  {
    moduleKey: "Fruit",
    iconSrc: "/images/icons/fruit.png",
    label: "Fruit",
    description: "法人格の実体・登記",
    statusLabel: "登記情報",
    statusValue: "6 法人",
    href: "/fruit",
  },
  {
    moduleKey: "Seed",
    iconSrc: "/images/icons/seed.png",
    label: "Seed",
    description: "新事業枠",
    statusLabel: "構想中",
    statusValue: "2 件",
    href: "/seed",
  },
  {
    moduleKey: "Forest",
    iconSrc: "/images/icons/forest.png",
    label: "Forest",
    description: "全法人決算",
    statusLabel: "対象期",
    statusValue: "FY2026",
    href: "/forest",
  },

  // ===== row 2: 地上レイヤー =====
  {
    moduleKey: "Bud",
    iconSrc: "/images/icons/bud.png",
    label: "Bud",
    description: "経理・収支",
    statusLabel: "未処理仕訳",
    statusValue: "12 件",
    statusTone: "alert",
    href: "/bud",
  },
  {
    moduleKey: "Leaf",
    iconSrc: "/images/icons/leaf.png",
    label: "Leaf",
    description: "商材・トスアップ",
    statusLabel: "承認待ち",
    statusValue: "6 件",
    statusTone: "warn",
    href: "/leaf",
  },
  {
    moduleKey: "Tree",
    iconSrc: "/images/icons/tree.png",
    label: "Tree",
    description: "架電アプリ",
    statusLabel: "架電予定",
    statusValue: "15 件",
    href: "/tree",
  },
  {
    moduleKey: "Sprout",
    iconSrc: "/images/icons/sprout.png",
    label: "Sprout",
    description: "採用・入社",
    statusLabel: "選考中",
    statusValue: "4 件",
    href: "/sprout",
  },

  // ===== row 3: 地下レイヤー =====
  {
    moduleKey: "Soil",
    iconSrc: "/images/icons/soil.png",
    label: "Soil",
    description: "DB・大量データ",
    statusLabel: "同期最終",
    statusValue: "5分前",
    href: "/soil",
  },
  {
    moduleKey: "Root",
    iconSrc: "/images/icons/root.png",
    label: "Root",
    description: "組織・顧客・マスタ",
    statusLabel: "期限超過",
    statusValue: "3 件",
    statusTone: "alert",
    href: "/root",
  },
  {
    moduleKey: "Rill",
    iconSrc: "/images/icons/rill.png",
    label: "Rill",
    description: "業務連絡・メッセージング",
    statusLabel: "未読",
    statusValue: "8 件",
    statusTone: "warn",
    href: "/rill",
  },
  {
    moduleKey: "Calendar",
    iconSrc: "/images/icons/calendar.png",
    label: "Calendar",
    description: "営業予定・シフト",
    statusLabel: "本日予定",
    statusValue: "7 件",
    href: "/calendar",
  },
];

type Props = {
  /**
   * 可視 module key の許可リスト（Task 2、plan §Step 2-3）。
   * 未指定なら従来通り全 12 module を描画（後方互換）。
   */
  visibleModules?: readonly string[];
  /** orb hover 時 callback */
  onOrbHover?: (moduleKey: string) => void;
  /** orb click 時 callback */
  onOrbClick?: (moduleKey: string) => void;
};

export default function OrbGrid({
  visibleModules,
  onOrbHover,
  onOrbClick,
}: Props = {}) {
  const filtered = visibleModules
    ? MODULES.filter((m) => visibleModules.includes(m.moduleKey))
    : MODULES;

  return (
    <section
      className="orb-grid"
      data-visible-count={filtered.length}
      data-role-filtered={visibleModules ? "true" : "false"}
    >
      {filtered.map((m) => (
        <OrbCard
          key={m.moduleKey}
          moduleKey={m.moduleKey}
          iconSrc={m.iconSrc}
          label={m.label}
          description={m.description}
          statusLabel={m.statusLabel}
          statusValue={m.statusValue}
          statusTone={m.statusTone}
          href={m.href}
          onMouseEnter={onOrbHover ? () => onOrbHover(m.moduleKey) : undefined}
          onClick={onOrbClick ? () => onOrbClick(m.moduleKey) : undefined}
        />
      ))}
    </section>
  );
}
