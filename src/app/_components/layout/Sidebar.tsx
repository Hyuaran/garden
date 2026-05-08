/**
 * Sidebar (v2.8a Step 3 — 静的版)
 *
 * DESIGN_SPEC §4-2
 *
 * 7 メニュー (ホーム/ダッシュボード/取引/顧客/ワークフロー/レポート/設定)
 * + Help & Tips カード（フッター）
 *
 * Step 3 ではホームに active class を付与。
 * 既存 src/app/_components/Sidebar.tsx は触らず、新規 layout/Sidebar.tsx を作成。
 */

type NavItem = {
  label: string;
  iconSrc: string;
  href: string;
  active?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "ホーム",
    iconSrc: "/images/menu_icons/menu_01_home.png",
    href: "/",
    active: true,
  },
  {
    label: "ダッシュボード",
    iconSrc: "/images/menu_icons/menu_02_dashboard.png",
    href: "#",
  },
  {
    label: "取引",
    iconSrc: "/images/menu_icons/menu_03_transactions.png",
    href: "#",
  },
  {
    label: "顧客",
    iconSrc: "/images/menu_icons/menu_04_customers.png",
    href: "#",
  },
  {
    label: "ワークフロー",
    iconSrc: "/images/menu_icons/menu_05_workflow.png",
    href: "#",
  },
  {
    label: "レポート",
    iconSrc: "/images/menu_icons/menu_06_reports.png",
    href: "#",
  },
  {
    label: "設定",
    iconSrc: "/images/menu_icons/menu_07_settings.png",
    href: "#",
  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <nav className="nav-menu">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={`nav-item${item.active ? " active" : ""}`}
          >
            <span className="nav-icon">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.iconSrc} alt="" />
            </span>
            <span className="nav-label">{item.label}</span>
          </a>
        ))}
      </nav>

      {/* ===== Help & Tips カード ===== */}
      <a href="#" className="help-card" title="Gardenシリーズの使い方">
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
      </a>
    </aside>
  );
}
