# main- No. 60 dispatch - a-bloom-003 /bloom/progress 実データ化（API ルート + v29 テンプレート方式） - 2026-05-05

> 起草: a-main-012
> 用途: /bloom/progress を実データ化（Garden 開発進捗のみ）、5/8 デモで「実データで動いてる」感を演出
> 番号: main- No. 60
> 起草時刻: 2026-05-05(火) 19:57
> 緊急度: 🔴 5/8 デモ向け（5/7 までに完成）

---

## 投下用短文（東海林さんが a-bloom-003 にコピペ）

~~~
🔴 main- No. 60
【a-main-012 から a-bloom-003 への dispatch（/bloom/progress 実データ化、API ルート + v29 テンプレート方式）】
発信日時: 2026-05-05(火) 19:57

東海林さん指示「Garden 開発進捗のみ実データにしたい」を実装します。/bloom/progress（v29 iframe）を実データ化、他 5 サブナビは現状維持。

【方針: A 案 API ルート + v29 テンプレート方式】

完全 React 化（v29 HTML 9221 行移植）は 5/8 までに不可能。代わりに以下：

1. v29 HTML をテンプレートとして使い、特定セクションに placeholder を埋め込む
2. API ルート `/api/bloom/progress-html` で:
   - 既存 `public/_proto/bloom-dev-progress/index.html` を fs.readFileSync で読込
   - Supabase から root_daily_reports / root_daily_report_logs / root_module_progress を fetch
   - 履歴タブ + モジュールタブの HTML を動的生成
   - placeholder を実データ HTML で文字列 replace
   - text/html で返却
3. /bloom/progress の iframe src を `/api/bloom/progress-html` に変更

→ v29 のスタイル / JS / 概要・設定タブはそのまま、履歴 + モジュールタブだけ実データ反映。

【スコープ（5/8 デモ向け）】

| タブ | 実データ化 | 優先度 |
|---|---|---|
| 履歴タブ | root_daily_reports + root_daily_report_logs | 🔴 最重要 |
| モジュールタブ | root_module_progress | 🟡 次重要 |
| 概要 | v29 静的のまま | 🟢 |
| 設定 | v29 静的のまま | 🟢 |

【実装ステップ】

# Step 1: v29 HTML テンプレート化

`public/_proto/bloom-dev-progress/index.html` を編集（legacy 保持）:

履歴タブの該当セクション（line 8577 付近 `<div class="gpd-history-list">` 内）:
```html
<div class="gpd-history-list">
  <!-- DATA_HISTORY_LIST_START -->
  <!-- ここに root_daily_reports + root_daily_report_logs から動的生成した日付カードを挿入 -->
  <!-- DATA_HISTORY_LIST_END -->
</div>
```

モジュールタブの目次（line 7541 付近 `<aside class="gpd-modules-toc">`）+ 詳細（line 7595 付近 `<div class="gpd-modules-detail">`）も同様に placeholder 化:
```html
<aside class="gpd-modules-toc ceo-card gs-scrollable">
  <!-- DATA_MODULE_TOC_START -->
  <!-- ここに root_module_progress から動的生成した目次を挿入 -->
  <!-- DATA_MODULE_TOC_END -->
</aside>
<div class="gpd-modules-detail">
  <!-- DATA_MODULE_DETAIL_START -->
  <!-- ここに root_module_progress から動的生成したカードを挿入 -->
  <!-- DATA_MODULE_DETAIL_END -->
</div>
```

→ 既存の v29 サンプル日付カード / モジュールカードは削除し、placeholder ブロックに置換。

# Step 2: API ルート作成

`src/app/api/bloom/progress-html/route.ts`（新規）:

```typescript
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js"; // service_role（or anon + admin RLS）

export async function GET() {
  // 1. v29 HTML 読込
  const tmplPath = path.join(process.cwd(), "public/_proto/bloom-dev-progress/index.html");
  let html = await fs.readFile(tmplPath, "utf-8");

  // 2. Supabase fetch
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // RLS bypass、Server side 限定
  );

  const [reports, logs, modules] = await Promise.all([
    supabase.from("root_daily_reports").select("*").order("date", { ascending: false }),
    supabase.from("root_daily_report_logs").select("*").order("ord"),
    supabase.from("root_module_progress").select("*"),
  ]);

  // 3. 履歴タブ HTML 生成
  const historyHtml = buildHistoryHtml(reports.data ?? [], logs.data ?? []);
  html = html.replace(
    /<!-- DATA_HISTORY_LIST_START -->[\s\S]*?<!-- DATA_HISTORY_LIST_END -->/,
    historyHtml
  );

  // 4. モジュールタブ HTML 生成
  const tocHtml = buildModuleTocHtml(modules.data ?? []);
  const detailHtml = buildModuleDetailHtml(modules.data ?? []);
  html = html.replace(/<!-- DATA_MODULE_TOC_START -->[\s\S]*?<!-- DATA_MODULE_TOC_END -->/, tocHtml);
  html = html.replace(/<!-- DATA_MODULE_DETAIL_START -->[\s\S]*?<!-- DATA_MODULE_DETAIL_END -->/, detailHtml);

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function buildHistoryHtml(reports: any[], logs: any[]): string {
  // v29 の <div class="ceo-card gpd-history-card"> 構造を再現
  return reports.map(report => {
    const dayLogs = logs.filter(l => l.report_date === report.date);
    const workLogs = dayLogs.filter(l => l.category === "work");
    const tomorrowLogs = dayLogs.filter(l => l.category === "tomorrow");
    // ... 各 li 生成
    return `
      <div class="ceo-card gpd-history-card">
        <div class="gpd-history-head">
          <span class="gpd-work-pill gpd-work-${report.workstyle ?? 'irregular'}">...</span>
          <span class="gpd-history-date">${formatDate(report.date)}</span>
          <span class="gpd-history-day">${formatDay(report.date)}</span>
        </div>
        <div class="gpd-history-body">
          <div class="gpd-history-cols">
            <div class="gpd-history-col">
              <h6 class="gpd-history-h">本日の作業</h6>
              <ul class="gpd-history-ul">
                ${workLogs.map(l => `<li>...${escapeHtml(l.content)}</li>`).join("")}
              </ul>
            </div>
            <div class="gpd-history-col">
              <h6 class="gpd-history-h">明日の予定</h6>
              <ul class="gpd-history-ul">
                ${tomorrowLogs.map(l => `<li>...${escapeHtml(l.content)}</li>`).join("")}
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// buildModuleTocHtml / buildModuleDetailHtml も同様に v29 構造再現
// escapeHtml: < > & " ' をエスケープ（XSS 防止）
```

注意:
- `process.env.SUPABASE_SERVICE_ROLE_KEY` は Server side 限定（client に漏洩しない）
- escapeHtml で XSS 防止必須

# Step 3: page.tsx の iframe src 変更

`src/app/bloom/progress/page.tsx`:
```tsx
// before
<iframe src="/_proto/bloom-dev-progress/index.html" ... />

// after
<iframe src="/api/bloom/progress-html" ... />
```

→ iframe height 等は既存のまま（calc(100vh - 153px)）。

# Step 4: ダミーデータでの動作確認（Supabase 未接続でも進められる）

Supabase 接続が槙さん招待 5/7 待ち。それまで:
- API ルート内に `if (process.env.MOCK_DATA === "1")` 分岐を入れて、ハードコード data で動作確認
- v29 のサンプルデータをそのまま入れて、文字列 replace 動作確認

→ 接続前に履歴 / モジュールタブの HTML 生成ロジック完成 OK。

【削除禁止ルール】

- public/_proto/bloom-dev-progress/index.legacy-template-replace-20260505.html
- src/app/bloom/progress/page.legacy-iframe-src-change-20260505.tsx
- src/app/api/bloom/progress-html/route.ts は新規ファイル、legacy 不要

【検証フロー（a-main-012 が再実施）】

修正後 push 受領 → Chrome MCP で:
1. `/api/bloom/progress-html` HTTP 200 + 動的 HTML 返却
2. /bloom/progress iframe 内に動的データ反映（履歴タブ：日付カード、モジュールタブ：12 module）
3. 5/7 Supabase 接続後、実データ（root_daily_reports 10 行 + 4/16-24 Chatwork 取り込み 9 日 + 4/25 明細 29 行）が表示される

【完了報告フォーマット】

bloom-003- No. 34 で:
- commit hash + push 状態
- # Step 1 v29 HTML placeholder 化（履歴タブ + モジュールタブ）before/after 行数
- # Step 2 API ルート実装（route.ts ファイル + buildHistoryHtml / buildModuleTocHtml / buildModuleDetailHtml ロジック概要）
- # Step 3 page.tsx iframe src 変更
- # Step 4 ダミーデータでの動作確認結果
- legacy 保持ファイル一覧
- 完了時刻

【期限】

- 5/6 朝〜夜: API ルート骨格 + ダミーデータ動作確認
- 5/7 朝（Supabase 招待後）: 接続テスト + 本番データ切替
- 5/7 昼〜夜: 履歴 + モジュールタブ動作確認
- 5/8 朝: 最終リハ

【dispatch counter】

a-main-012: 次 main- No. 61
a-bloom-003: bloom-003- No. 34 で完了報告予定

工数見込み: 4〜6 時間（HTML テンプレート化 + API ルート + buildHTML 関数 + ダミー動作確認）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 19:57 初版（a-main-012、東海林さん指示「Garden 開発進捗のみ実データ」採用）
