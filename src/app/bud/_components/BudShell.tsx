"use client";

/**
 * Garden-Bud — レイアウトシェル
 *
 * PC (md以上):   左サイドナビ固定(w-56 emerald) + 右メインコンテンツ
 * スマホ (md未満): 上部ハンバーガーヘッダー + タップでドロワーメニュー
 *
 * Phase 0 では振込・明細・給与の各画面は未実装のため「準備中」バッジを表示。
 */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useBudState } from "../_state/BudStateContext";
import { BUD_ROLE_LABELS } from "../_constants/roles";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  phase: number; // 0=実装済み、1以降=準備中
}

const NAV_ITEMS: NavItem[] = [
  { href: "/bud/dashboard", label: "ダッシュボード", icon: "📊", phase: 0 },
  { href: "/bud/transfers", label: "振込管理",       icon: "💸", phase: 1 },
  { href: "/bud/statements", label: "入出金明細",     icon: "📋", phase: 2 },
  { href: "/bud/payroll",    label: "給与処理",       icon: "💰", phase: 3 },
];

const ROOT_LINKS = [
  { href: "/root/companies", label: "法人マスタ" },
  { href: "/root/vendors",   label: "取引先マスタ" },
  { href: "/root/employees", label: "従業員マスタ" },
];

export function BudShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { sessionUser, signOut } = useBudState();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.replace("/bud/login");
  }

  const navLinks = (onLinkClick?: () => void) =>
    NAV_ITEMS.map((item) => {
      const isActive = pathname?.startsWith(item.href) ?? false;
      const isDisabled = item.phase > 0;
      return (
        <Link
          key={item.href}
          href={isDisabled ? "#" : item.href}
          onClick={isDisabled ? undefined : onLinkClick}
          className={[
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors",
            isActive
              ? "bg-emerald-600 text-white"
              : "text-emerald-100 hover:bg-emerald-700",
            isDisabled ? "opacity-40 cursor-not-allowed pointer-events-none" : "",
          ].join(" ")}
        >
          <span>{item.icon}</span>
          <span className="flex-1">{item.label}</span>
          {isDisabled && (
            <span className="text-xs text-emerald-400">準備中</span>
          )}
        </Link>
      );
    });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ========== PC サイドナビ ========== */}
      <aside className="hidden md:flex flex-col w-56 bg-emerald-800 text-white shrink-0">
        <div className="px-4 py-5 border-b border-emerald-700">
          <div className="text-base font-bold tracking-wide">🌱 Garden-Bud</div>
          <div className="text-xs text-emerald-300 mt-0.5">経理・収支</div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navLinks()}

          <div className="mt-4 pt-4 border-t border-emerald-700">
            <p className="px-3 text-xs text-emerald-400 mb-2">マスタ管理 →</p>
            {ROOT_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-emerald-300 hover:bg-emerald-700 transition-colors"
              >
                <span>↗</span>
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        </nav>

        <div className="px-4 py-3 border-t border-emerald-700">
          <div className="text-sm font-medium truncate">
            {sessionUser?.name ?? "-"}
          </div>
          <div className="text-xs text-emerald-300 mt-0.5">
            {sessionUser
              ? BUD_ROLE_LABELS[sessionUser.effective_bud_role]
              : ""}
          </div>
          <button
            onClick={handleSignOut}
            className="mt-2 text-xs text-emerald-400 hover:text-white transition-colors"
          >
            ログアウト
          </button>
        </div>
      </aside>

      {/* ========== スマホ ハンバーガーヘッダー ========== */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-emerald-800 text-white px-4 py-3 flex items-center justify-between shadow">
        <div className="text-sm font-bold">🌱 Garden-Bud</div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-emerald-100 p-1 text-lg"
          aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* スマホ ドロワー */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute top-0 left-0 bottom-0 w-64 bg-emerald-800 text-white pt-14 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="py-3 px-2">{navLinks(() => setMenuOpen(false))}</nav>
            <div className="px-4 py-3 border-t border-emerald-700">
              <div className="text-sm font-medium">
                {sessionUser?.name ?? "-"}
              </div>
              <div className="text-xs text-emerald-300 mt-0.5">
                {sessionUser
                  ? BUD_ROLE_LABELS[sessionUser.effective_bud_role]
                  : ""}
              </div>
              <button
                onClick={handleSignOut}
                className="mt-2 text-xs text-emerald-400 hover:text-white"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== メインコンテンツ ========== */}
      <main className="flex-1 overflow-y-auto md:mt-0 mt-12">{children}</main>
    </div>
  );
}
