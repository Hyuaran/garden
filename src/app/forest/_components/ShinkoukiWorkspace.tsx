"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { C } from "../_constants/colors";
import type { Company, Shinkouki } from "../_constants/companies";
import { FOREST_THEME } from "../_constants/theme";
import { fmtYen } from "../_lib/format";
import { isForestAdmin } from "../_lib/permissions";
import { useForestState } from "../_state/ForestStateContext";
import { AccessDenied } from "./AccessDenied";
import { NumberUpdateForm } from "./NumberUpdateForm";
import { PeriodRolloverForm } from "./PeriodRolloverForm";

type Mode = "overview" | "detail";
type Tab = "numbers" | "rollover";

type Props = {
  mode: Mode;
  companyId?: string;
};

type CompanyPair = {
  company: Company;
  shinkouki: Shinkouki | null;
};

const panelStyle = {
  background: FOREST_THEME.panelBg,
  backdropFilter: "blur(20px)",
  border: `1px solid ${FOREST_THEME.panelBorder}`,
  borderRadius: FOREST_THEME.panelRadius,
  boxShadow: FOREST_THEME.panelShadow,
} as const;

function getRangeParts(shinkouki: Shinkouki | null) {
  const [from = "", to = ""] = shinkouki?.range.split("~") ?? [];
  return { from, to };
}

function MetricRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "7px 0",
        borderBottom: "1px solid rgba(27,67,50,0.08)",
      }}
    >
      <span style={{ color: FOREST_THEME.textMuted, fontSize: 12 }}>{label}</span>
      <span style={{ color: tone ?? FOREST_THEME.textPrimary, fontSize: 13, fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
}

function ShinkoukiSummary({ company, shinkouki }: CompanyPair) {
  const { from, to } = getRangeParts(shinkouki);
  const isNegative = (shinkouki?.rieki ?? 0) < 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: company.color,
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: C.darkGreen, fontSize: 15, fontWeight: 800 }}>{company.short}</div>
          <div style={{ color: FOREST_THEME.textMuted, fontSize: 11 }}>{company.name}</div>
        </div>
        <span
          style={{
            marginLeft: "auto",
            padding: "2px 8px",
            borderRadius: 4,
            background: FOREST_THEME.shinkouBadge,
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          進行期
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <MetricRow label="期" value={shinkouki ? `第${shinkouki.ki}期` : "-"} />
        <MetricRow label="年度" value={shinkouki ? `${shinkouki.yr}年度` : "-"} />
        <MetricRow label="状態" value={shinkouki?.zantei ? "暫定" : "確定"} />
      </div>

      <div
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          background: "rgba(184,134,11,0.06)",
          border: "1px solid rgba(184,134,11,0.16)",
          marginBottom: 10,
          fontSize: 12,
          color: FOREST_THEME.textSecondary,
          lineHeight: 1.7,
        }}
      >
        <div>{from && to ? `${from} - ${to}` : shinkouki?.label ?? "進行期データなし"}</div>
        <div>{shinkouki?.reflected || "反映済み期間は未設定"}</div>
      </div>

      <MetricRow label="売上高" value={fmtYen(shinkouki?.uriage ?? null)} />
      <MetricRow label="外注費" value={fmtYen(shinkouki?.gaichuhi ?? null)} />
      <MetricRow
        label="利益"
        value={fmtYen(shinkouki?.rieki ?? null)}
        tone={isNegative ? FOREST_THEME.negative : FOREST_THEME.positive}
      />
    </div>
  );
}

function TabButtons({
  active,
  onChange,
  disabled,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  disabled: boolean;
}) {
  const items: { key: Tab; label: string }[] = [
    { key: "numbers", label: "数値更新" },
    { key: "rollover", label: "期の切り替え" },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        borderBottom: `1px solid ${C.mintBg}`,
        marginBottom: 18,
      }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          disabled={disabled}
          style={{
            padding: "10px 14px",
            border: "none",
            background: "transparent",
            borderBottom:
              active === item.key ? `2px solid ${C.midGreen}` : "2px solid transparent",
            color: active === item.key ? C.midGreen : C.textSub,
            fontSize: 13,
            fontWeight: active === item.key ? 700 : 500,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.55 : 1,
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ReadOnlyNotice({ isAdmin }: { isAdmin: boolean }) {
  if (isAdmin) return null;
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "rgba(255,255,255,0.55)",
        border: `1px solid ${FOREST_THEME.panelBorder}`,
        color: FOREST_THEME.textSecondary,
        fontSize: 13,
        lineHeight: 1.7,
      }}
    >
      閲覧権限のため、進行期の編集フォームは表示していません。
    </div>
  );
}

function CompanyEditor({
  company,
  shinkouki,
  activeTab,
  onTabChange,
  isAdmin,
  refreshData,
  compact,
}: CompanyPair & {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  isAdmin: boolean;
  refreshData: () => Promise<void>;
  compact?: boolean;
}) {
  return (
    <section style={{ ...panelStyle, padding: compact ? 20 : 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "minmax(0, 1fr)" : "minmax(260px, 0.7fr) minmax(360px, 1fr)",
          gap: compact ? 18 : 24,
          alignItems: "start",
        }}
      >
        <div>
          <ShinkoukiSummary company={company} shinkouki={shinkouki} />
          {compact && (
            <Link
              href={`/forest/shinkouki/${company.id}`}
              style={{
                display: "inline-flex",
                marginTop: 14,
                color: C.midGreen,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              この法人だけ詳しく見る / 編集
            </Link>
          )}
        </div>

        <div>
          <TabButtons active={activeTab} onChange={onTabChange} disabled={!isAdmin || !shinkouki} />
          {!shinkouki ? (
            <div style={{ color: FOREST_THEME.textMuted, fontSize: 13 }}>
              進行期データが見つかりません。
            </div>
          ) : isAdmin ? (
            activeTab === "numbers" ? (
              <NumberUpdateForm
                companyId={company.id}
                initial={shinkouki}
                onSaved={refreshData}
                onClose={() => undefined}
              />
            ) : (
              <PeriodRolloverForm
                companyId={company.id}
                current={shinkouki}
                onRolledOver={refreshData}
                onClose={() => undefined}
              />
            )
          ) : (
            <ReadOnlyNotice isAdmin={isAdmin} />
          )}
        </div>
      </div>
    </section>
  );
}

export function ShinkoukiWorkspace({ mode, companyId }: Props) {
  const router = useRouter();
  const {
    loading,
    isAuthenticated,
    hasPermission,
    isUnlocked,
    companies,
    shinkouki,
    forestUser,
    refreshData,
  } = useForestState();
  const [tabs, setTabs] = useState<Record<string, Tab>>({});

  const isAdmin = isForestAdmin(forestUser);
  const pairs = useMemo<CompanyPair[]>(
    () =>
      companies.map((company) => ({
        company,
        shinkouki: shinkouki.find((row) => row.company_id === company.id) ?? null,
      })),
    [companies, shinkouki],
  );

  const selectedIndex = companyId ? pairs.findIndex((item) => item.company.id === companyId) : -1;
  const selected = selectedIndex >= 0 ? pairs[selectedIndex] : null;
  const activePairs = mode === "detail" && selected ? [selected] : pairs;

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !isUnlocked) {
      router.replace("/forest/login");
    }
  }, [loading, isAuthenticated, isUnlocked, router]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: FOREST_THEME.textMuted }}>
        読み込み中...
      </div>
    );
  }

  if (!isAuthenticated || !hasPermission) {
    return <AccessDenied />;
  }

  if (!isUnlocked) return null;

  const setCompanyTab = (id: string, tab: Tab) => {
    setTabs((current) => ({ ...current, [id]: tab }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ ...panelStyle, padding: "18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: FOREST_THEME.textMuted, fontSize: 12, fontWeight: 700 }}>
              Garden Forest
            </div>
            <h2 style={{ margin: "4px 0 6px", color: C.darkGreen, fontSize: 24 }}>
              進行期の更新
            </h2>
            <p style={{ margin: 0, color: FOREST_THEME.textSecondary, fontSize: 13 }}>
              進行期の数字を更新する画面です。確定期の閲覧は既存ダッシュボードを使います。
            </p>
          </div>
          <Link
            href="/forest/dashboard"
            style={{
              alignSelf: "flex-start",
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${C.lightGreen}`,
              color: C.midGreen,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
              background: "rgba(255,255,255,0.45)",
            }}
          >
            ダッシュボードへ
          </Link>
        </div>
      </div>

      {mode === "detail" && selected && (
        <div style={{ ...panelStyle, padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/forest/shinkouki" style={{ color: C.midGreen, fontSize: 13, fontWeight: 700 }}>
            6法人まとめへ
          </Link>
          <span style={{ color: FOREST_THEME.textMuted, fontSize: 12 }}>
            {selectedIndex + 1} / {pairs.length}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Link
              href={
                selectedIndex > 0
                  ? `/forest/shinkouki/${pairs[selectedIndex - 1].company.id}`
                  : "#"
              }
              aria-disabled={selectedIndex <= 0}
              style={{
                color: selectedIndex > 0 ? C.midGreen : FOREST_THEME.textMuted,
                fontSize: 13,
                pointerEvents: selectedIndex > 0 ? "auto" : "none",
              }}
            >
              前の法人
            </Link>
            <Link
              href={
                selectedIndex < pairs.length - 1
                  ? `/forest/shinkouki/${pairs[selectedIndex + 1].company.id}`
                  : "#"
              }
              aria-disabled={selectedIndex >= pairs.length - 1}
              style={{
                color: selectedIndex < pairs.length - 1 ? C.midGreen : FOREST_THEME.textMuted,
                fontSize: 13,
                pointerEvents: selectedIndex < pairs.length - 1 ? "auto" : "none",
              }}
            >
              次の法人
            </Link>
          </div>
        </div>
      )}

      {mode === "detail" && !selected ? (
        <div style={{ ...panelStyle, padding: 24, color: FOREST_THEME.textSecondary }}>
          指定された法人が見つかりません。
        </div>
      ) : (
        activePairs.map(({ company, shinkouki: row }) => (
          <CompanyEditor
            key={company.id}
            company={company}
            shinkouki={row}
            activeTab={tabs[company.id] ?? "numbers"}
            onTabChange={(tab) => setCompanyTab(company.id, tab)}
            isAdmin={isAdmin}
            refreshData={refreshData}
            compact={mode === "overview"}
          />
        ))
      )}
    </div>
  );
}
