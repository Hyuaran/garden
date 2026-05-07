/**
 * GET /api/bloom/progress-html
 *
 * dispatch main- No.60 (2026-05-05): Bloom 開発進捗 v29 を実データで動的描画。
 *
 * 動作:
 *   1. public/_proto/bloom-dev-progress/index.html (テンプレート化済) を読込
 *   2. Supabase から root_daily_reports / root_daily_report_logs / root_module_progress を fetch
 *   3. 履歴タブ + モジュールタブの HTML を動的生成し placeholder を replace
 *   4. text/html で返却
 *
 * フォールバック:
 *   - process.env.MOCK_DATA === "1" or Supabase fetch エラー時は内蔵モックデータを使用
 *   - 槙さん招待後 (5/7 想定) Supabase 接続テスト → 本番データ切替
 */

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Workstyle = "office" | "home" | "irregular";

type DailyReport = {
  date: string; // YYYY-MM-DD
  workstyle: Workstyle;
  special?: string | null;
};

type DailyReportLog = {
  report_date: string;
  category: "work" | "tomorrow" | "special";
  module: string; // bloom / forest / tree / ...
  content: string;
  ord?: number | null;
};

type ModuleProgress = {
  code: string;
  name_jp: string;
  name_en: string;
  percent: number;
  group: "樹冠（経営層）" | "地上（業務オペ）" | "地下（基盤）";
  phase_pills?: string[];
  phase_active?: string;
  release?: string | null;
};

const MOCK_REPORTS: DailyReport[] = [
  { date: "2026-04-24", workstyle: "irregular", special: "横断する共通仕様の整理、作業ルール整備、引き継ぎ資料作成" },
  { date: "2026-04-23", workstyle: "office", special: null },
  { date: "2026-04-22", workstyle: "home", special: null },
];

const MOCK_LOGS: DailyReportLog[] = [
  // 4/24
  { report_date: "2026-04-24", category: "work", module: "forest", content: "進行期編集機能の本番運用フォロー、会社マスタ統合機能の設計準備", ord: 1 },
  { report_date: "2026-04-24", category: "work", module: "tree", content: "誕生日 4 桁で自動ログインできる認証システム完成", ord: 2 },
  { report_date: "2026-04-24", category: "work", module: "root", content: "勤怠管理システム（King of Time）との自動データ取込機能を実装", ord: 3 },
  { report_date: "2026-04-24", category: "work", module: "bloom", content: "画面切替機能、Chatwork 自動通知の基盤、月次レポートの自動 PDF 生成", ord: 4 },
  { report_date: "2026-04-24", category: "tomorrow", module: "forest", content: "会社マスタ統合の設計・着手", ord: 1 },
  { report_date: "2026-04-24", category: "tomorrow", module: "bud", content: "振込管理の 5 画面実装", ord: 2 },
  // 4/23
  { report_date: "2026-04-23", category: "work", module: "bud", content: "経理画面の認証機能実装 + データベース設計・セキュリティ", ord: 1 },
  { report_date: "2026-04-23", category: "work", module: "leaf", content: "新規案件登録画面（営業自動補完）+ ステータス 1 クリック操作 UI 追加", ord: 2 },
  { report_date: "2026-04-23", category: "work", module: "root", content: "従業員情報テーブルの拡張（権限・誕生日）と 7 段階権限対応", ord: 3 },
  { report_date: "2026-04-23", category: "tomorrow", module: "forest", content: "本番公開の確認、会社マスタ統合の設計・着手", ord: 1 },
  // 4/22
  { report_date: "2026-04-22", category: "work", module: "tree", content: "通話履歴の自動保存機能を実装", ord: 1 },
  { report_date: "2026-04-22", category: "tomorrow", module: "tree", content: "誕生日認証の実環境テスト", ord: 1 },
];

const MOCK_MODULES: ModuleProgress[] = [
  { code: "bloom", name_jp: "Bloom", name_en: "グループ全体の動きと業績を見える化", percent: 65, group: "樹冠（経営層）", phase_pills: ["Phase B（進行中）", "Phase C"], phase_active: "Phase B", release: "26/08" },
  { code: "forest", name_jp: "Forest", name_en: "全法人の決算・税務・経営指標を一元管理", percent: 70, group: "樹冠（経営層）", phase_pills: ["Phase A（運用中）"], phase_active: "Phase A", release: "稼働中" },
  { code: "fruit", name_jp: "Fruit", name_en: "法人の法的実体情報", percent: 0, group: "樹冠（経営層）", phase_pills: ["Phase B（予定）"], phase_active: null as unknown as string, release: null },
  { code: "seed", name_jp: "Seed", name_en: "新事業・新商材の拡張枠", percent: 0, group: "樹冠（経営層）", phase_pills: ["Phase C（予定）"], phase_active: null as unknown as string, release: null },
  { code: "bud", name_jp: "Bud", name_en: "経理・収支管理", percent: 55, group: "地上（業務オペ）", phase_pills: ["Phase A（仕上げ）", "Phase B"], phase_active: "Phase A", release: "26/06" },
  { code: "leaf", name_jp: "Leaf", name_en: "商材×商流の個別アプリ・トスアップ", percent: 60, group: "地上（業務オペ）", phase_pills: ["Phase B（進行中）"], phase_active: "Phase B", release: "26/07" },
  { code: "tree", name_jp: "Tree", name_en: "架電アプリ（コールセンターの要）", percent: 100, group: "地上（業務オペ）", phase_pills: ["Phase D（最終仕上げ）"], phase_active: "Phase D", release: "26/09" },
  { code: "sprout", name_jp: "Sprout", name_en: "採用→面接→内定→入社準備", percent: 0, group: "地上（業務オペ）", phase_pills: ["Phase B（仕様済）"], phase_active: null as unknown as string, release: null },
  { code: "calendar", name_jp: "Calendar", name_en: "営業予定・面接スロット・シフト統合", percent: 0, group: "地上（業務オペ）", phase_pills: ["Phase B（仕様済）"], phase_active: null as unknown as string, release: null },
  { code: "soil", name_jp: "Soil", name_en: "DB 基盤・大量データ", percent: 0, group: "地下（基盤）", phase_pills: ["Phase C（仕様済）"], phase_active: null as unknown as string, release: null },
  { code: "root", name_jp: "Root", name_en: "組織・従業員・パートナー・マスタ", percent: 100, group: "地下（基盤）", phase_pills: ["Phase A（運用中）", "Phase B"], phase_active: "Phase A", release: "稼働中" },
  { code: "rill", name_jp: "Rill", name_en: "社内メッセージアプリ", percent: 35, group: "地下（基盤）", phase_pills: ["Phase B（進行中）"], phase_active: "Phase B", release: "26/10" },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateSlash(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${y}/${m}/${d}`;
}

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
function formatDayJa(isoDate: string): string {
  const dt = new Date(isoDate + "T00:00:00+09:00");
  return `（${DAY_LABELS[dt.getDay()]}）`;
}

function workstylePill(ws: Workstyle): string {
  const icon =
    ws === "office"
      ? '<img src="images/decor/icon_work_office.png" alt="出社">'
      : ws === "home"
        ? '<img src="images/decor/icon_work_home.png" alt="在宅">'
        : '<img src="images/decor/icon_work_irregular.png" alt="イレギュラー">';
  return `<span class="gpd-work-pill gpd-work-${ws}">${icon}</span>`;
}

function moduleNameJa(code: string): string {
  const map: Record<string, string> = {
    bloom: "Bloom", forest: "Forest", fruit: "Fruit", seed: "Seed",
    bud: "Bud", leaf: "Leaf", tree: "Tree", sprout: "Sprout", calendar: "Calendar",
    soil: "Soil", root: "Root", rill: "Rill",
  };
  return map[code] ?? code;
}

function moduleIconHtml(code: string, alt = ""): string {
  return `<span class="gpd-mod-icon"><img src="images/icons_bloom/orb_${code}.png" alt="${escapeHtml(alt)}"></span>`;
}

function buildHistoryHtml(reports: DailyReport[], logs: DailyReportLog[]): string {
  if (reports.length === 0) {
    return `      <div class="ceo-card gpd-history-card"><div class="gpd-history-body" style="padding:24px;color:#6b8e75">日報データはまだありません</div></div>`;
  }
  const cards = reports.map((report) => {
    const dayLogs = logs.filter((l) => l.report_date === report.date);
    const work = dayLogs.filter((l) => l.category === "work").sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
    const tomorrow = dayLogs.filter((l) => l.category === "tomorrow").sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));

    const workItems = work.length === 0
      ? `<li class="gpd-history-empty">記載なし</li>`
      : work.map((l) =>
          `<li>${moduleIconHtml(l.module)}<span class="gpd-mod-name">${escapeHtml(moduleNameJa(l.module))}</span><span class="gpd-mod-text">${escapeHtml(l.content)}</span></li>`,
        ).join("\n              ");

    const tomorrowItems = tomorrow.length === 0
      ? `<li class="gpd-history-empty">記載なし</li>`
      : tomorrow.map((l) =>
          `<li>${moduleIconHtml(l.module)}<span class="gpd-mod-name">${escapeHtml(moduleNameJa(l.module))}</span><span class="gpd-mod-text">${escapeHtml(l.content)}</span></li>`,
        ).join("\n              ");

    const specialBlock = report.special
      ? `<div class="gpd-history-special"><h6 class="gpd-history-h">特記事項</h6><ul class="gpd-special-ul"><li>${escapeHtml(report.special)}</li></ul></div>`
      : `<div class="gpd-history-special gpd-history-special-empty"><h6 class="gpd-history-h">特記事項</h6><ul class="gpd-special-ul"><li class="gpd-history-empty">記載なし</li></ul></div>`;

    return `
      <div class="ceo-card gpd-history-card">
        <div class="gpd-history-head">
          ${workstylePill(report.workstyle)}
          <span class="gpd-history-date">${escapeHtml(formatDateSlash(report.date))}</span>
          <span class="gpd-history-day">${escapeHtml(formatDayJa(report.date))}</span>
        </div>
        <div class="gpd-history-body">
          <div class="gpd-history-cols">
            <div class="gpd-history-col">
              <h6 class="gpd-history-h">本日の作業</h6>
              <ul class="gpd-history-ul">
              ${workItems}
              </ul>
            </div>
            <div class="gpd-history-col">
              <h6 class="gpd-history-h">明日の予定</h6>
              <ul class="gpd-history-ul">
              ${tomorrowItems}
              </ul>
            </div>
          </div>
        </div>
        ${specialBlock}
      </div>`;
  });
  return cards.join("\n");
}

function buildModuleTocHtml(modules: ModuleProgress[]): string {
  const groups = ["樹冠（経営層）", "地上（業務オペ）", "地下（基盤）"] as const;
  const blocks = groups.map((g) => {
    const items = modules.filter((m) => m.group === g);
    if (items.length === 0) return "";
    const h = `<h4 class="gpd-toc-h">${escapeHtml(g)}</h4>`;
    const rows = items.map((m) => `        <div class="gpd-toc-item" data-target="gpd-mod-${escapeHtml(m.code)}">
          <span class="gpd-toc-orb"><img src="images/icons_bloom/orb_${escapeHtml(m.code)}.png" alt=""></span><span class="gpd-toc-name">${escapeHtml(m.name_jp)}</span><span class="gpd-toc-pct">${m.percent}%</span>
        </div>`).join("\n");
    return `        ${h}\n${rows}`;
  });
  return blocks.filter(Boolean).join("\n\n");
}

function buildModuleDetailHtml(modules: ModuleProgress[]): string {
  const cards = modules.map((m) => {
    const pills = (m.phase_pills ?? []).map((p, i) => {
      const cls = i === 0 && m.phase_active ? "gpd-mc-pill gpd-mc-pill-now" : "gpd-mc-pill";
      return `<span class="${cls}">${escapeHtml(p)}</span>`;
    }).join("");

    const releaseBlock = m.release
      ? `<div class="gpd-mc-section"><h5 class="gpd-mc-h">リリース予定</h5><div class="gpd-mc-release"><span class="gpd-mc-release-date">${escapeHtml(m.release)}</span></div></div>`
      : "";

    return `        <div class="ceo-card gpd-module-card expanded" id="gpd-mod-${escapeHtml(m.code)}">
          <div class="gpd-mc-head">
            <span class="gpd-mc-orb"><img src="images/icons_bloom/orb_${escapeHtml(m.code)}.png" alt=""></span>
            <div class="gpd-mc-name-block">
              <div class="gpd-mc-jp">${escapeHtml(m.name_jp)}</div>
              <div class="gpd-mc-en">${escapeHtml(m.name_en)}</div>
            </div>
            <span class="gpd-mc-pct">${m.percent}%</span>
            <span class="gpd-mc-toggle">▾</span>
          </div>
          <div class="gpd-mc-body">
            <div class="gpd-mc-section">
              <h5 class="gpd-mc-h">全体進捗</h5>
              <div class="gs-progress"><div class="gs-progress-fill" style="width:${m.percent}%;"></div></div>
            </div>
            <div class="gpd-mc-section">
              <h5 class="gpd-mc-h">関連 Phase</h5>
              <div class="gpd-mc-pills">${pills}</div>
            </div>
            ${releaseBlock}
          </div>
        </div>`;
  });
  return cards.join("\n");
}

async function fetchData(): Promise<{ reports: DailyReport[]; logs: DailyReportLog[]; modules: ModuleProgress[]; source: "mock" | "supabase" }> {
  const useMock = process.env.MOCK_DATA === "1";
  if (useMock) {
    return { reports: MOCK_REPORTS, logs: MOCK_LOGS, modules: MOCK_MODULES, source: "mock" };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { reports: MOCK_REPORTS, logs: MOCK_LOGS, modules: MOCK_MODULES, source: "mock" };
  }

  try {
    const sb = createClient(url, serviceKey);
    const [r, l, m] = await Promise.all([
      sb.from("root_daily_reports").select("*").order("date", { ascending: false }).limit(30),
      sb.from("root_daily_report_logs").select("*"),
      sb.from("root_module_progress").select("*"),
    ]);
    if (r.error || l.error || m.error) {
      // テーブル未作成等 → モック使用
      return { reports: MOCK_REPORTS, logs: MOCK_LOGS, modules: MOCK_MODULES, source: "mock" };
    }
    const reports = (r.data ?? []) as DailyReport[];
    const logs = (l.data ?? []) as DailyReportLog[];
    const modules = (m.data ?? []) as ModuleProgress[];
    if (reports.length === 0 && logs.length === 0 && modules.length === 0) {
      return { reports: MOCK_REPORTS, logs: MOCK_LOGS, modules: MOCK_MODULES, source: "mock" };
    }
    return { reports, logs, modules, source: "supabase" };
  } catch {
    return { reports: MOCK_REPORTS, logs: MOCK_LOGS, modules: MOCK_MODULES, source: "mock" };
  }
}

export async function GET() {
  const tmplPath = path.join(process.cwd(), "public/_proto/bloom-dev-progress/index.html");
  let html = await fs.readFile(tmplPath, "utf-8");

  const { reports, logs, modules, source } = await fetchData();

  const historyHtml = buildHistoryHtml(reports, logs);
  const tocHtml = buildModuleTocHtml(modules);
  const detailHtml = buildModuleDetailHtml(modules);

  html = html.replace(
    /<!-- DATA_HISTORY_LIST_START -->[\s\S]*?<!-- DATA_HISTORY_LIST_END -->/,
    historyHtml,
  );
  html = html.replace(
    /<!-- DATA_MODULE_TOC_START -->[\s\S]*?<!-- DATA_MODULE_TOC_END -->/,
    tocHtml,
  );
  html = html.replace(
    /<!-- DATA_MODULE_DETAIL_START -->[\s\S]*?<!-- DATA_MODULE_DETAIL_END -->/,
    detailHtml,
  );

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Data-Source": source,
      "Cache-Control": "no-store",
    },
  });
}
