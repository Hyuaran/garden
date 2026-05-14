"use client";

/**
 * Garden-Bud — 銀行口座管理 (残高画面)
 *
 * spec: bud-08-銀行口座管理画面.png 完全再現
 * data:
 *   - root_bank_accounts (12 口座、is_active=true)
 *   - root_bank_transactions (160 件、4/1-5/13、5/13 a-main-026 INSERT)
 *
 * 残高計算:
 *   口座別 5/13 残高 = manual_balance_20260430 (4/30 基準) + SUM(amount where 5/1 ≤ tx_date)
 */

import { useEffect, useMemo, useState } from "react";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";
import { supabase } from "@/app/bloom/_lib/supabase";

const T = "/themes/garden-shell";

// 法人 / 銀行 メタデータ
const CORPS = [
  { code: "hyuaran",     short: "ヒュアラン" },
  { code: "centerrise",  short: "センターライズ" },
  { code: "linksupport", short: "リンクサポート" },
  { code: "arata",       short: "ARATA" },
  { code: "taiyou",      short: "たいよう" },
  { code: "ichi",        short: "壱" },
];

const BANKS = [
  { code: "mizuho",  label: "みずほ銀行 普通" },
  { code: "rakuten", label: "楽天銀行 普通" },
  { code: "paypay",  label: "PayPay 銀行 普通" },
  { code: "kyoto",   label: "京都銀行 普通" },
];

const BUD_PAGE_MENU = [
  { label: "ダッシュボード",   href: "/bud/dashboard",   icon: `${T}/images/icons_bloom/bloom_workboard.png` },
  { label: "銀行口座管理",     href: "/bud/balance",     icon: `${T}/images/icons_bloom/bloom_workboard.png`, active: true },
  { label: "仕訳帳",            href: "/bud/shiwakechou", icon: `${T}/images/icons_bloom/bloom_dailyreport.png` },
  { label: "明細",              href: "/bud/statements",  icon: `${T}/images/icons_bloom/bloom_monthlydigest.png` },
  { label: "振込",              href: "/bud/transfers",   icon: `${T}/images/icons_bloom/bloom_ceostatus.png` },
];

interface Account {
  id: string;
  corp_code: string;
  bank_code: string;
  bank_name: string;
  branch_name: string | null;
  account_number: string;
  account_type: string;
  sub_account_label: string | null;
  manual_balance_20260430: number | null;
}

interface Tx {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
}

const fmtYen = (n: number | null | undefined): string =>
  n == null ? "—" : `¥${n.toLocaleString("ja-JP")}`;

const fmtDelta = (n: number): string => {
  if (n === 0) return "↑ +¥0";
  if (n > 0) return `↑ +¥${n.toLocaleString("ja-JP")}`;
  return `▲ ¥${Math.abs(n).toLocaleString("ja-JP")}`;
};

export default function BudBalancePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;
    (async () => {
      const [{ data: a }, { data: t }] = await Promise.all([
        supabase
          .from("root_bank_accounts")
          .select("id,corp_code,bank_code,bank_name,branch_name,account_number,account_type,sub_account_label,manual_balance_20260430")
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("corp_code"),
        supabase
          .from("root_bank_transactions")
          .select("id,bank_account_id,transaction_date,amount,description")
          .order("transaction_date"),
      ]);
      if (!canceled) {
        setAccounts((a ?? []) as Account[]);
        setTxs((t ?? []) as Tx[]);
        setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, []);

  // === 集計 ===
  const stats = useMemo(() => {
    if (loading) return null;
    // 口座 ID → 残高（4/30 基準 + 5月分純額）
    const txByAcct: Record<string, number> = {};
    const txByDate: Record<string, number> = {};
    const today = "2026-05-14"; // 当日基準
    let dailyDeposit = 0, dailyWithdraw = 0;
    let mayDelta = 0;
    for (const t of txs) {
      const amt = Number(t.amount);
      txByAcct[t.bank_account_id] = (txByAcct[t.bank_account_id] ?? 0) + amt;
      txByDate[t.transaction_date] = (txByDate[t.transaction_date] ?? 0) + amt;
      if (t.transaction_date >= "2026-05-01") mayDelta += amt;
      if (t.transaction_date === today) {
        if (amt >= 0) dailyDeposit += amt;
        else dailyWithdraw += -amt;
      }
    }
    // 各口座の 5/13 残高
    const balanceByAcct: Record<string, number> = {};
    for (const a of accounts) {
      const base = Number(a.manual_balance_20260430 ?? 0);
      // base は 4/30 時点 → 5月以降の純額のみ加算
      const mayNet = txs
        .filter(t => t.bank_account_id === a.id && t.transaction_date >= "2026-05-01")
        .reduce((s, t) => s + Number(t.amount), 0);
      balanceByAcct[a.id] = base + mayNet;
    }
    const totalBalance = Object.values(balanceByAcct).reduce((s, v) => s + v, 0);
    const accountCount = accounts.length;
    const corpCount = new Set(accounts.map(a => a.corp_code)).size;
    const typeCount: Record<string, number> = {};
    for (const a of accounts) typeCount[a.account_type] = (typeCount[a.account_type] ?? 0) + 1;
    // 30 日推移（全社合計、5/14 から 30 日遡る）
    const trend: { date: string; balance: number; isSalary: boolean; isTransfer: boolean }[] = [];
    // 全 tx の累積 (4/1 起点) → 各日末残高
    // baseStart = 4/30 残高 (manual_balance) 合計 - 4月分純額 = 4/1 期初残高
    const totalBase430 = accounts.reduce((s, a) => s + Number(a.manual_balance_20260430 ?? 0), 0);
    const aprNet = txs.filter(t => t.transaction_date < "2026-05-01").reduce((s, t) => s + Number(t.amount), 0);
    const totalBase401 = totalBase430 - aprNet;
    let cum = totalBase401;
    const datesSorted = Object.keys(txByDate).sort();
    const allDates: string[] = [];
    let d = new Date("2026-04-15"); // 30 日推移の左端
    for (let i = 0; i < 30; i++) {
      const iso = d.toISOString().slice(0, 10);
      allDates.push(iso);
      d.setDate(d.getDate() + 1);
    }
    // 各日末残高
    const txByDateAll: Record<string, number> = txByDate;
    let runningCum = totalBase401;
    // 4/1 - 30 日推移開始日 (4/15) までの累積をまず計算
    const presortedDates = datesSorted.filter(dt => dt >= "2026-04-01" && dt < "2026-04-15");
    for (const dt of presortedDates) runningCum += txByDateAll[dt];
    for (const iso of allDates) {
      runningCum += txByDateAll[iso] ?? 0;
      const dayNum = parseInt(iso.slice(8, 10), 10);
      trend.push({
        date: iso,
        balance: runningCum,
        isSalary: dayNum === 25,
        isTransfer: dayNum === 10 || dayNum === 15,
      });
    }
    // 当日 TOP 5（最新日付の入出金 上位 5）
    const recentDate = datesSorted[datesSorted.length - 1] ?? today;
    const top5 = txs
      .filter(t => t.transaction_date === recentDate)
      .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
      .slice(0, 5)
      .map(t => {
        const acct = accounts.find(a => a.id === t.bank_account_id);
        return {
          time: "—",
          corp: CORPS.find(c => c.code === acct?.corp_code)?.short ?? acct?.corp_code ?? "?",
          bank: BANKS.find(b => b.code === acct?.bank_code)?.label.replace(" 普通", " 普通") ?? acct?.bank_code,
          flow: Number(t.amount) >= 0 ? "入金" : "出金",
          amount: Number(t.amount),
          desc: t.description?.slice(0, 18) ?? "",
        };
      });
    return {
      balanceByAcct,
      totalBalance,
      accountCount,
      corpCount,
      typeCount,
      dailyDeposit,
      dailyWithdraw,
      trend,
      top5,
      recentDate,
      mayDelta,
    };
  }, [accounts, txs, loading]);

  // 法人 × 銀行 マトリクス計算
  const matrix = useMemo(() => {
    if (!stats) return null;
    type Cell = { balance: number; delta: number; hasAcct: boolean };
    const grid: Record<string, Record<string, Cell>> = {};
    for (const c of CORPS) {
      grid[c.code] = {};
      for (const b of BANKS) {
        const acct = accounts.find(a => a.corp_code === c.code && a.bank_code === b.code);
        if (acct) {
          const balance = stats.balanceByAcct[acct.id] ?? 0;
          const delta = txs
            .filter(t => t.bank_account_id === acct.id && t.transaction_date >= "2026-05-01")
            .reduce((s, t) => s + Number(t.amount), 0);
          grid[c.code][b.code] = { balance, delta, hasAcct: true };
        } else {
          grid[c.code][b.code] = { balance: 0, delta: 0, hasAcct: false };
        }
      }
    }
    // 列合計（銀行ごと）
    const bankTotals: Record<string, { balance: number; delta: number }> = {};
    for (const b of BANKS) {
      bankTotals[b.code] = { balance: 0, delta: 0 };
      for (const c of CORPS) {
        bankTotals[b.code].balance += grid[c.code][b.code].balance;
        bankTotals[b.code].delta   += grid[c.code][b.code].delta;
      }
    }
    // 行合計（法人ごと）
    const corpTotals: Record<string, { balance: number; delta: number }> = {};
    for (const c of CORPS) {
      corpTotals[c.code] = { balance: 0, delta: 0 };
      for (const b of BANKS) {
        corpTotals[c.code].balance += grid[c.code][b.code].balance;
        corpTotals[c.code].delta   += grid[c.code][b.code].delta;
      }
    }
    return { grid, bankTotals, corpTotals };
  }, [stats, accounts, txs]);

  return (
    <GardenShell
      activeModule="bud"
      moduleName="Bud"
      moduleIcon={`${T}/images/icons_bloom/orb_bud.png`}
      pageMenu={BUD_PAGE_MENU}
    >
      <PageHeader
        title="銀行口座管理"
        titleJp="お金の通り道を、見渡す"
        subtitle="法人 × 口座 マトリクス + 残高推移 + 口座マスタ"
        accessBadge={{ icon: "👑", label: "全権管理者 + 経理担当 / executive 閲覧可" }}
      />

      <nav className="tab-nav">
        <button className="tab-item active"><span className="tab-item-jp">マトリクス</span>/ Matrix</button>
        <button className="tab-item"><span className="tab-item-jp">残高推移</span>/ Trends</button>
        <button className="tab-item"><span className="tab-item-jp">入出金履歴</span>/ Transactions</button>
        <button className="tab-item tab-item-settings"><span className="tab-item-jp">マスタ</span>/ Master</button>
      </nav>

      <div className="tab-content active">
        {loading || !stats || !matrix ? (
          <div className="ceo-card" style={{ padding: 40, textAlign: "center", color: "var(--text-sub)" }}>
            🌿 残高データを読み込み中...
          </div>
        ) : (
          <>
            {/* 法人セレクタ */}
            <div className="ceo-card" style={{ padding: "14px 18px", marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button className="priority-filter-btn active" style={{ padding: "8px 18px" }}>全法人合算</button>
              {CORPS.map(c => (
                <button key={c.code} className="priority-filter-btn" style={{ padding: "8px 18px" }}>{c.short}</button>
              ))}
            </div>

            {/* KPI 3 カード */}
            <div className="kpi-integrated-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 18 }}>
              <div className="kpi-integrated-card">
                <div className="kpi-integrated-header">
                  <div className="kpi-integrated-icon">🏦</div>
                  <div className="kpi-integrated-label">全口座合計残高</div>
                </div>
                <div className="kpi-integrated-value">
                  <span className="kpi-integrated-value-yen">¥</span>{stats.totalBalance.toLocaleString("ja-JP")}
                </div>
                <div className="kpi-integrated-yoy">
                  <span className="kpi-integrated-yoy-label">5月分推移</span>
                  <span className="kpi-integrated-yoy-arrow">{stats.mayDelta >= 0 ? "↑" : "▼"}</span>
                  <span>{stats.mayDelta >= 0 ? "+" : ""}¥{Math.abs(stats.mayDelta).toLocaleString("ja-JP")}</span>
                </div>
              </div>
              <div className="kpi-integrated-card">
                <div className="kpi-integrated-header">
                  <div className="kpi-integrated-icon">📊</div>
                  <div className="kpi-integrated-label">法人数 / 口座総数</div>
                </div>
                <div className="kpi-integrated-value">
                  {stats.corpCount}<span className="kpi-integrated-value-unit"> 法人 / </span>{stats.accountCount}<span className="kpi-integrated-value-unit"> 口座</span>
                </div>
                <div className="kpi-integrated-yoy">
                  <span className="kpi-integrated-yoy-label">構成</span>
                  <span>{Object.entries(stats.typeCount).map(([k,v]) => `${k} ${v}`).join(" + ")}</span>
                </div>
              </div>
              <div className="kpi-integrated-card">
                <div className="kpi-integrated-header">
                  <div className="kpi-integrated-icon">🔄</div>
                  <div className="kpi-integrated-label">当日入出金 ({stats.recentDate})</div>
                </div>
                <div className="kpi-integrated-value" style={{ fontSize: "1.6rem", lineHeight: 1.4 }}>
                  入金 ¥{stats.dailyDeposit.toLocaleString("ja-JP")}
                  <br />
                  <span style={{ color: "var(--text-warning)" }}>出金 ¥{stats.dailyWithdraw.toLocaleString("ja-JP")}</span>
                </div>
              </div>
            </div>

            {/* 中央: マトリクス + 推移グラフ 横並び */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 18 }}>
              {/* 法人 × 口座マトリクス */}
              <div className="ceo-card" style={{ padding: "16px 20px" }}>
                <div className="ceo-card-title">法人 × 口座マトリクス<span className="ceo-card-title-sub">— 5/13 時点残高</span></div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", marginTop: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-soft)" }}>
                        <th style={{ textAlign: "left", padding: "8px 4px", color: "var(--text-sub)", fontWeight: 500 }}>口座</th>
                        {CORPS.map(c => (
                          <th key={c.code} style={{ textAlign: "right", padding: "8px 4px", color: "var(--text-sub)", fontWeight: 500 }}>{c.short}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {BANKS.map(b => (
                        <tr key={b.code} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                          <td style={{ padding: "10px 4px", color: "var(--text-main)", fontWeight: 500 }}>{b.label}</td>
                          {CORPS.map(c => {
                            const cell = matrix.grid[c.code][b.code];
                            if (!cell.hasAcct) return <td key={c.code} style={{ textAlign: "right", padding: "10px 4px", color: "var(--text-muted)" }}>—</td>;
                            return (
                              <td key={c.code} style={{ textAlign: "right", padding: "10px 4px" }}>
                                <div style={{ color: "var(--text-main)" }}>{fmtYen(cell.balance)}</div>
                                <div style={{ fontSize: "0.72rem", color: cell.delta < 0 ? "var(--text-warning)" : "var(--text-success)" }}>
                                  {fmtDelta(cell.delta)}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* 合計 */}
                      <tr style={{ background: "rgba(212, 165, 65, 0.08)" }}>
                        <td style={{ padding: "12px 4px", color: "var(--text-main)", fontWeight: 600 }}>合計</td>
                        {CORPS.map(c => {
                          const t = matrix.corpTotals[c.code];
                          return (
                            <td key={c.code} style={{ textAlign: "right", padding: "12px 4px" }}>
                              <div style={{ color: "var(--text-main)", fontWeight: 600 }}>{fmtYen(t.balance)}</div>
                              <div style={{ fontSize: "0.72rem", color: t.delta < 0 ? "var(--text-warning)" : "var(--text-success)" }}>
                                {fmtDelta(t.delta)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 残高推移グラフ (自前 SVG、Garden トーン) */}
              <div className="ceo-card" style={{ padding: "16px 20px" }}>
                <div className="ceo-card-title">全社合計 残高推移<span className="ceo-card-title-sub">— 過去 30 日</span></div>
                <div style={{ marginTop: 8, fontSize: "0.74rem", color: "var(--text-sub)", display: "flex", gap: 14 }}>
                  <span>● <span style={{ color: "var(--accent-gold)" }}>残高</span></span>
                  <span>★ <span style={{ color: "#d4a541" }}>給与日 (25日)</span></span>
                  <span>◆ <span style={{ color: "var(--accent-blue)" }}>振替日 (10日 / 15日)</span></span>
                </div>
                <BalanceTrendChart trend={stats.trend} />
              </div>
            </div>

            {/* 下段: 口座マスタ + TOP 5 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 16, marginBottom: 18 }}>
              <div className="ceo-card" style={{ padding: "16px 20px" }}>
                <div className="ceo-card-title">口座マスタ<span className="ceo-card-title-sub">— {accounts.length} 口座</span></div>
                <button style={{ marginTop: 12, padding: "10px 18px", background: "var(--accent-gold)", color: "white", border: "none", borderRadius: 8, fontSize: "0.85rem", fontWeight: 500 }}>
                  ＋ 口座追加
                </button>
                <div style={{ marginTop: 16, fontSize: "0.78rem", color: "var(--text-sub)" }}>最近の変更履歴</div>
                <ul style={{ marginTop: 8, listStyle: "none", padding: 0, fontSize: "0.78rem", color: "var(--text-main)" }}>
                  <li style={{ padding: "8px 0", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between" }}>
                    <span>5/13 ヒュアラン みずほ普通 取引取込（74 件）</span>
                    <span style={{ color: "var(--accent-green-d)", fontSize: "0.72rem" }}>反映済</span>
                  </li>
                  <li style={{ padding: "8px 0", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between" }}>
                    <span>5/13 ヒュアラン 楽天普通 取引取込（86 件）</span>
                    <span style={{ color: "var(--accent-green-d)", fontSize: "0.72rem" }}>反映済</span>
                  </li>
                  <li style={{ padding: "8px 0", display: "flex", justifyContent: "space-between" }}>
                    <span>5/13 root_bank_accounts 統合（旧 bud_bank_*）</span>
                    <span style={{ color: "var(--accent-green-d)", fontSize: "0.72rem" }}>反映済</span>
                  </li>
                </ul>
              </div>

              <div className="ceo-card" style={{ padding: "16px 20px" }}>
                <div className="ceo-card-title">最新日 大口入出金 TOP 5<span className="ceo-card-title-sub">— {stats.recentDate}</span></div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", marginTop: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-soft)", color: "var(--text-sub)" }}>
                      <th style={{ textAlign: "left", padding: "6px 4px", fontWeight: 500 }}>法人</th>
                      <th style={{ textAlign: "left", padding: "6px 4px", fontWeight: 500 }}>口座</th>
                      <th style={{ textAlign: "left", padding: "6px 4px", fontWeight: 500 }}>種別</th>
                      <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 500 }}>金額</th>
                      <th style={{ textAlign: "left", padding: "6px 4px", fontWeight: 500 }}>摘要</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.top5.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                        <td style={{ padding: "8px 4px", color: "var(--text-main)" }}>{r.corp}</td>
                        <td style={{ padding: "8px 4px", color: "var(--text-main)" }}>{r.bank}</td>
                        <td style={{ padding: "8px 4px", color: r.flow === "入金" ? "var(--text-success)" : "var(--text-warning)" }}>{r.flow}</td>
                        <td style={{ padding: "8px 4px", textAlign: "right", color: r.amount < 0 ? "var(--text-warning)" : "var(--text-main)" }}>
                          {r.amount >= 0 ? "+" : "▲ "}¥{Math.abs(r.amount).toLocaleString("ja-JP")}
                        </td>
                        <td style={{ padding: "8px 4px", color: "var(--text-sub)", fontSize: "0.74rem" }}>{r.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bloom / Forest 連携バー */}
            <div className="ceo-card" style={{ padding: "14px 20px", marginBottom: 18 }}>
              <div style={{ fontSize: "0.85rem", color: "var(--text-sub)", marginBottom: 10, fontWeight: 500 }}>Bloom / Forest へのミラー</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ padding: "12px 16px", border: "1px solid var(--border-soft)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: "1.4rem" }}>🥧</span>
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <div style={{ color: "var(--text-main)" }}>全口座残高サマリ → Bloom <code>balance-overview</code></div>
                    <div style={{ color: "var(--text-sub)", fontSize: "0.74rem" }}>後道代表閲覧、連携頻度: 即時</div>
                  </div>
                  <span style={{ color: "var(--accent-gold)" }}>›</span>
                </div>
                <div style={{ padding: "12px 16px", border: "1px solid var(--border-soft)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: "1.4rem" }}>🌿</span>
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <div style={{ color: "var(--text-main)" }}>月末残高 → Forest 決算</div>
                    <div style={{ color: "var(--text-sub)", fontSize: "0.74rem" }}>連携頻度: 月末締日時</div>
                  </div>
                  <span style={{ color: "var(--accent-gold)" }}>›</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </GardenShell>
  );
}

// ===== 残高推移チャート (自前 SVG、Garden トーン) =====
function BalanceTrendChart({ trend }: { trend: { date: string; balance: number; isSalary: boolean; isTransfer: boolean }[] }) {
  if (!trend.length) return null;
  const W = 520;
  const H = 200;
  const padL = 60;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const xs = trend.map((_, i) => padL + (i * (W - padL - padR)) / Math.max(trend.length - 1, 1));
  const min = Math.min(...trend.map(t => t.balance));
  const max = Math.max(...trend.map(t => t.balance));
  const range = max - min || 1;
  const ys = trend.map(t => padT + (1 - (t.balance - min) / range) * (H - padT - padB));
  const points = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");

  // Y 軸ラベル (4 段階)
  const yTicks = [0, 0.33, 0.67, 1].map(p => {
    const v = min + range * (1 - p);
    const y = padT + p * (H - padT - padB);
    return { v, y };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", marginTop: 8 }}>
      {/* Y 軸グリッド */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="rgba(154,138,105,0.15)" strokeDasharray="2,3" />
          <text x={padL - 6} y={t.y + 3} fontSize="9" textAnchor="end" fill="#8a7f6a" fontFamily="EB Garamond, serif">
            ¥{(t.v / 1_000_000).toFixed(1)}M
          </text>
        </g>
      ))}
      {/* X 軸ラベル (5 日おき) */}
      {trend.map((t, i) => i % 5 === 0 && (
        <text key={i} x={xs[i]} y={H - 8} fontSize="9" textAnchor="middle" fill="#8a7f6a" fontFamily="EB Garamond, serif">
          {t.date.slice(5)}
        </text>
      ))}
      {/* 折れ線 (Garden ゴールド) */}
      <polyline points={points} fill="none" stroke="#d4a541" strokeWidth="1.8" strokeLinejoin="round" />
      {/* 各点 + マーカー */}
      {trend.map((t, i) => (
        <g key={i}>
          <circle cx={xs[i]} cy={ys[i]} r="2.5" fill="#d4a541" />
          {t.isSalary && (
            <text x={xs[i]} y={ys[i] - 6} fontSize="11" textAnchor="middle" fill="#d4a541">★</text>
          )}
          {t.isTransfer && (
            <text x={xs[i]} y={ys[i] - 6} fontSize="9" textAnchor="middle" fill="#5a8fa8">◆</text>
          )}
        </g>
      ))}
    </svg>
  );
}
