"use client";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { BudGate } from "../_components/BudGate";
import { getBudGardenPageMenu } from "../_components/bud-garden-menu";
import { useBudState } from "../_state/BudStateContext";

const BUD_ICON = "/themes/garden-shell/images/icons_bloom/orb_bud.png";

function formatRoleLabel(role: string | null): string {
  if (role === "admin") return "全権管理者 + 経理担当";
  if (role === "approver") return "承認者 + 経理担当";
  if (role === "staff") return "経理担当";
  return "Bud";
}

export default function ReceivablesPage() {
  const { sessionUser, signOut, budRole } = useBudState();
  const userName = sessionUser?.name ?? "東海林 美琴";
  const roleLabel = formatRoleLabel(budRole);

  return (
    <BudGate>
      <GardenShell
        activeModule="bud"
        pageMenu={getBudGardenPageMenu("/bud/receivables")}
        userName={userName}
        userEmail={sessionUser?.employee_number ? `${sessionUser.employee_number}@garden.local` : null}
        userRoleLabel={roleLabel}
        onLogout={signOut}
      >
        <PageHeader
          title="入金管理"
          titleJp="入金の流れを、整える準備"
          subtitle="入金管理は準備中です。"
          accessBadge={{ icon: "♕", label: roleLabel }}
          moduleMark="bud"
          favoriteIcon={BUD_ICON}
        />

        <section
          aria-label="入金管理 準備中"
          style={{
            alignItems: "center",
            background: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: 8,
            boxShadow: "var(--shadow-soft)",
            color: "var(--text-main)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            justifyContent: "center",
            minHeight: 260,
            padding: "48px 28px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "var(--text-accent)",
              fontFamily: "var(--font-shippori), 'Shippori Mincho', serif",
              fontSize: "0.86rem",
              letterSpacing: "0.12em",
              margin: 0,
            }}
          >
            COMING SOON
          </p>
          <h2
            style={{
              fontFamily: "var(--font-shippori), 'Shippori Mincho', serif",
              fontSize: "1.35rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              margin: 0,
            }}
          >
            入金管理は準備中です
          </h2>
          <p
            style={{
              color: "var(--text-sub)",
              fontFamily: "var(--font-shippori), 'Shippori Mincho', serif",
              fontSize: "0.92rem",
              letterSpacing: "0.04em",
              lineHeight: 1.8,
              margin: 0,
              maxWidth: 520,
            }}
          >
            請求書、入金予定、消込の流れをここに集約する予定です。
            本実装までは他のBud画面から処理を続けてください。
          </p>
        </section>
      </GardenShell>
    </BudGate>
  );
}
