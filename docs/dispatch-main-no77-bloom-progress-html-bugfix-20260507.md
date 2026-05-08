# dispatch main- No. 77 — a-bloom-003 通知（/api/bloom/progress-html 500 エラー 緊急修正依頼）

発信元: a-main-013
発信日時: 2026-05-07(木) 14:14
発信先: a-bloom-003
件名: /api/bloom/progress-html 500 エラー修正（DB 列名ミスマッチ + GET 関数 try/catch 不足）
緊急度: 🔴 高（5/8 後道さんデモまでに修正希望）

---

## 1. 状況報告

a-main-013 が以下を実施し、Supabase 側の準備は完了しました：
- ✅ Supabase migration 4 件 適用（root_daily_reports / logs / module_progress / 4 月期間 INSERT）
- ✅ import script 実行（state.txt → 4/25 + 29 ログ取込）
- ✅ DB 検証（progress=12 / reports=3 / logs=31）

その後、`/api/bloom/progress-html` の `x-data-source: mock → supabase` 自動切替確認のため
`a-bloom-003` で `npm run dev -- --port 3001` 起動 → curl テスト

**結果: HTTP 500 Internal Server Error**（response body 空）

---

## 2. 原因分析（コード解析ベース）

`src/app/api/bloom/progress-html/route.ts` を解析。

### 2-1. GET 関数全体に try/catch がない

```ts
export async function GET() {
  const tmplPath = path.join(...);
  let html = await fs.readFile(tmplPath, "utf-8");        // [1]
  const { reports, logs, modules, source } = await fetchData();  // [2] try/catch あり
  const historyHtml = buildHistoryHtml(reports, logs);    // [3] try/catch なし ← ここで例外可能
  const tocHtml = buildModuleTocHtml(modules);            // [4]
  const detailHtml = buildModuleDetailHtml(modules);      // [5]
  ...
}
```

`fetchData()` 内部は try/catch あり（Supabase 接続失敗で mock fallback OK）だが、
**[3]-[5] の build*Html 関数で例外発生 → uncaught → Next.js が 500 返却**。

### 2-2. DB 列名と TS 型のミスマッチ

`root_module_progress` テーブル（migration 3）:
```sql
module / progress_pct / phase / status / summary / updated_at
```

`ModuleProgress` TS 型（route.ts L40）:
```ts
{ code, name_jp, name_en, percent, group, phase_pills, phase_active, release }
```

**完全に列名が違う**。Supabase から `select * from root_module_progress` で返される行は
`{ module, progress_pct, ... }` 形式だが、それを `ModuleProgress[]` にキャストしているため、
- `m.code` → undefined
- `m.percent` → undefined
- `m.group` → undefined
- `m.phase_pills` → undefined
- `m.release` → undefined

オプショナル / null check で例外は逃げているが、**列名差で「Supabase データはあるのに空表示」になる**潜在バグ。

### 2-3. 推定の例外発生箇所

`buildHistoryHtml` 内の `formatDateSlash(report.date)`:
```ts
function formatDateSlash(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");  // ← report.date が Date オブジェクトで返ると TypeError
  return `${y}/${m}/${d}`;
}
```

Supabase JS client は **PostgreSQL の `date` 型を文字列 "2026-04-25" で返す**のが標準だが、
client version や設定で Date オブジェクトに変換される場合あり。
もし Date 化されると `report.date.split is not a function` で 500。

---

## 3. 修正方針案（推奨）

### 修正 A: GET 関数全体に try/catch（最優先 / 5 分）

```ts
export async function GET() {
  try {
    const tmplPath = path.join(process.cwd(), "public/_proto/bloom-dev-progress/index.html");
    let html = await fs.readFile(tmplPath, "utf-8");
    const { reports, logs, modules, source } = await fetchData();
    const historyHtml = buildHistoryHtml(reports, logs);
    const tocHtml = buildModuleTocHtml(modules);
    const detailHtml = buildModuleDetailHtml(modules);
    html = html.replace(/<!-- DATA_HISTORY_LIST_START -->[\s\S]*?<!-- DATA_HISTORY_LIST_END -->/, historyHtml);
    html = html.replace(/<!-- DATA_MODULE_TOC_START -->[\s\S]*?<!-- DATA_MODULE_TOC_END -->/, tocHtml);
    html = html.replace(/<!-- DATA_MODULE_DETAIL_START -->[\s\S]*?<!-- DATA_MODULE_DETAIL_END -->/, detailHtml);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Data-Source": source,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    // フォールバック: mock データで再構築
    console.error("[/api/bloom/progress-html] error:", e);
    const tmplPath = path.join(process.cwd(), "public/_proto/bloom-dev-progress/index.html");
    let html = await fs.readFile(tmplPath, "utf-8");
    const historyHtml = buildHistoryHtml(MOCK_REPORTS, MOCK_LOGS);
    const tocHtml = buildModuleTocHtml(MOCK_MODULES);
    const detailHtml = buildModuleDetailHtml(MOCK_MODULES);
    html = html.replace(/<!-- DATA_HISTORY_LIST_START -->[\s\S]*?<!-- DATA_HISTORY_LIST_END -->/, historyHtml);
    html = html.replace(/<!-- DATA_MODULE_TOC_START -->[\s\S]*?<!-- DATA_MODULE_TOC_END -->/, tocHtml);
    html = html.replace(/<!-- DATA_MODULE_DETAIL_START -->[\s\S]*?<!-- DATA_MODULE_DETAIL_END -->/, detailHtml);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Data-Source": "mock-fallback",
        "Cache-Control": "no-store",
      },
    });
  }
}
```

これだけで 500 → 200 になる（mock-fallback で表示はされる）。

### 修正 B: DB 列名 → TS 型のマッピング関数（次優先 / 30 分）

`fetchData()` 内で Supabase 結果を TS 型に変換するマッピング関数を追加：

```ts
function mapModuleProgress(row: { module: string; progress_pct: number; phase: string; status: string; summary: string }): ModuleProgress {
  // 12 モジュールの code / name_jp / name_en / group / release は固定マスタとしてここで補完
  const META: Record<string, Pick<ModuleProgress, "code" | "name_jp" | "name_en" | "group" | "release">> = {
    Bloom: { code: "bloom", name_jp: "Bloom", name_en: "グループ全体の動きと業績を見える化", group: "樹冠（経営層）", release: "26/08" },
    Forest: { code: "forest", name_jp: "Forest", name_en: "全法人の決算・税務・経営指標を一元管理", group: "樹冠（経営層）", release: "稼働中" },
    // ... 12 モジュール分
  };
  const meta = META[row.module] ?? { code: row.module.toLowerCase(), name_jp: row.module, name_en: row.summary, group: "地下（基盤）" as const, release: null };
  return {
    ...meta,
    percent: row.progress_pct,
    phase_pills: [`Phase ${row.phase}（${row.status}）`],
    phase_active: `Phase ${row.phase}`,
  };
}
```

### 修正 C: report.date の型ガード（補強 / 10 分）

```ts
function formatDateSlash(isoDate: string | Date): string {
  const s = typeof isoDate === "string" ? isoDate : isoDate.toISOString().slice(0, 10);
  const [y, m, d] = s.split("-");
  return `${y}/${m}/${d}`;
}
```

---

## 4. 修正の優先度と所要時間

| 優先 | 修正 | 所要 | 効果 |
|---|---|---|---|
| 🔴 最優先 | A: GET try/catch | 5 分 | 500 → 200（fallback で表示） |
| 🟡 次 | C: 型ガード | 10 分 | 例外原因の根絶 |
| 🟢 余裕あれば | B: マッピング関数 | 30 分 | x-data-source: supabase で意味のあるデータ表示 |

**5/8 デモまでに最低 A + C** 適用希望。B は post-デモでも可（Supabase 接続自体は確立、データ表示が空でも mock-fallback で代替可能）。

---

## 5. a-bloom-003 が実施する作業

1. `git pull origin <作業ブランチ>` で最新化
2. 上記分析を踏まえ、`src/app/api/bloom/progress-html/route.ts` に修正 A, C 適用
3. ローカル `npm run dev -- --port 3001` で起動
4. `curl -sI http://localhost:3001/api/bloom/progress-html` で
   - 200 OK ✅
   - `X-Data-Source: supabase` or `mock-fallback`
5. 修正 B も含めて time 許せば適用
6. 完了時 bloom-003- No. NN（次番号）で a-main に報告

---

## 6. 参考情報

- a-main-013 が起動した dev server は本 dispatch 投下後 kill 予定（port 3001 解放）
- 修正中はログ閲覧のため、a-bloom-003 側で foreground 起動推奨（PowerShell ターミナル経由）
- 5/7 中の修正が間に合わない場合 → 5/8 デモは MOCK_DATA=1 で実施（見栄え保証）

---

## 7. 旧コードの併存ルール

CLAUDE.md「コードリプレース時の旧版データ保持」ルール厳守:
- `route.ts` を直接編集する場合、変更前のコードを `route.legacy-20260507.ts` 等で残す
- または diff コミットで履歴保持

---

ご確認・着手お願いします。判断保留事項あれば即停止 → a-main-013 経由で東海林さんに確認依頼。
