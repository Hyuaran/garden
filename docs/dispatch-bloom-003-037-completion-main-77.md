~~~
🟢 bloom-003- No. 37
発信元: a-bloom-003
発信日時: 2026-05-07(木) 14:35
件名: main- No. 77 完了報告（/api/bloom/progress-html 500 → 200 + Supabase 実データ表示）

## commit / push
- commit: `16fafa5` fix(bloom): /api/bloom/progress-html 500 修正 + Supabase 実データ表示 [dispatch main- No.77]
- push: origin/feature/bloom-6screens-vercel-2026-05 ✅

## 適用した修正（A + B + C 全て）

### 修正 A: GET 関数全体に try/catch
- ビルド失敗時 mock-fallback で 200 維持（X-Data-Source: mock-fallback）
- テンプレート読込失敗時のみ 500 + 静的 HTML
- 二段フォールバック（mock-fallback も失敗 → template-only）追加

### 修正 B: DB 列名 → TS 型マッピング関数
| マッピング関数 | DB スキーマ → TS 型 |
|---|---|
| `mapDbModule` | `{module, progress_pct, phase, status, summary}` → `ModuleProgress` |
| `mapDbLog` | `{report_date, category, module, content, ord}` → `DailyReportLog`（大文字→小文字、work/tomorrow/special のみ通過） |
| `mapDbReport` | `{date, workstyle, is_irregular, irregular_label}` → `DailyReport`（workstyle null→irregular、irregular_label→special） |

`MODULE_META` マスタ（12 module 固定）で code/name_jp/name_en/group/release を補完。phase_pills/phase_active を phase+status から動的生成。

### 修正 C: 型ガード（string | Date 両対応）
- `formatDateSlash` / `formatDayJa`: string でも Date でも受入
- `buildHistoryHtml` 内 report_date 比較も string 化して一致判定

### 副改善（Supabase 接続検証で発見）
- workstylePill null → "irregular" フォールバック
- moduleNameJa 大文字小文字両方対応（DB は "Bloom"、画像 path は "bloom"）
- DB module 空時 mock のモジュールで補完（部分実データ表示）

## 検証結果（本セッション curl、Supabase 接続済環境）

| 検証項目 | 結果 |
|---|---|
| GET /api/bloom/progress-html | **HTTP 200** ✅（3.1s 初回 compile） |
| X-Data-Source ヘッダ | **supabase** ✅（mock じゃない、実データ経路） |
| 履歴カード `gpd-history-card` | **3 件** ✅（DB reports=3 と一致） |
| モジュールカード `gpd-module-card` | **12 件** ✅（DB progress=12 と一致） |

## a-main-013 環境状態の整合確認

| データ | DB 値 | API 応答 |
|---|---|---|
| root_module_progress | 12 | 12 件モジュールカード描画 ✅ |
| root_daily_reports | 3 | 3 件履歴カード描画 ✅ |
| root_daily_report_logs | 31 | 履歴カード内に分散表示（3 reports × 各 work/tomorrow） |

logs 31 件の内訳は、`mapDbLog` が work/tomorrow/special のみ通過させるため、carryover/planned 等は除外。各日付カード内で正しく分布表示。

## legacy 保持ファイル一覧（削除禁止）
- src/app/api/bloom/progress-html/route.legacy-20260507-bugfix.ts （新規、修正前）

（main- No. 41/42/44/45/48/50/56/58/60/61 で作成済 legacy 22 件も継続保持）

## 完了時刻
2026-05-07(木) 14:35（受領 14:14 → 完了 14:35、所要 21 分）

## 検証依頼
a-main-013 で再確認お願いします:
1. `curl -sI http://localhost:3000/api/bloom/progress-html` → 200 + X-Data-Source: supabase
2. /bloom/progress iframe 内で 3 日付の実データ + 12 モジュールの実データ表示
3. workstyle / module 名 / 日付フォーマット が想定通り
4. 5/8 デモまでに残課題あれば次 dispatch（修正 B のマスタ補完など）

## 補足: 5/8 デモ向け
- Supabase 接続経路で実データ表示が確立。MOCK_DATA=1 切替不要。
- 万一接続不安定時は X-Data-Source: mock-fallback で自動退避（200 維持）。
- 視覚 / DOM 検証は a-main 系列の Chrome MCP で再実施推奨。

a-bloom-003 待機中（次 bloom-003- No. 38、main- No. 78+ 待ち）
~~~
