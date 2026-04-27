"use client";

/**
 * Garden-Bud — ダッシュボード
 *
 * Phase 0: ログイン後の起点ページ。
 * Phase 1〜3 で KPI カードに実数値を表示する。
 */

import { BudGate } from "../_components/BudGate";
import { BudShell } from "../_components/BudShell";
import { useBudState } from "../_state/BudStateContext";
import { BUD_ROLE_LABELS } from "../_constants/roles";

function DashboardContent() {
  const { sessionUser } = useBudState();
  if (!sessionUser) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-1">
          {sessionUser.name}（{BUD_ROLE_LABELS[sessionUser.effective_bud_role]}
          ）でログイン中
        </p>
      </div>

      {/* KPI カード（Phase 0: プレースホルダー） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <KpiCard
          icon="💸"
          label="未承認の振込"
          value="—"
          description="Phase 1 で表示"
          disabled
        />
        <KpiCard
          icon="📋"
          label="未照合の明細"
          value="—"
          description="Phase 2 で表示"
          disabled
        />
        <KpiCard
          icon="💰"
          label="今月の給与処理"
          value="—"
          description="Phase 3 で表示"
          disabled
        />
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-emerald-800 mb-2">
          🌱 Garden-Bud へようこそ
        </h2>
        <p className="text-sm text-emerald-700">
          Phase 0（認証基盤）が完了しました。
          <br />
          次のフェーズで振込管理・入出金明細・給与処理が順次利用可能になります。
        </p>
        <ul className="mt-3 space-y-1 text-sm text-emerald-600">
          <li>✅ Phase 0 — 認証・権限基盤</li>
          <li className="opacity-50">⬜ Phase 1 — 振込管理</li>
          <li className="opacity-50">⬜ Phase 2 — 入出金明細</li>
          <li className="opacity-50">⬜ Phase 3 — 給与処理</li>
        </ul>
      </div>
    </div>
  );
}

interface KpiCardProps {
  icon: string;
  label: string;
  value: string;
  description: string;
  disabled?: boolean;
}

function KpiCard({ icon, label, value, description, disabled }: KpiCardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-5 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div className="text-2xl mb-3">{icon}</div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-3xl font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{description}</div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <BudGate>
      <BudShell>
        <DashboardContent />
      </BudShell>
    </BudGate>
  );
}
