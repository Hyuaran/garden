~~~
🟢 bloom-003- No. 34
発信元: a-bloom-003
発信日時: 2026-05-05(火) 20:03
件名: main- No. 60 完了報告（/bloom/progress 実データ化、API ルート + v29 テンプレート方式）

## commit / push
- commit: `1ba0442` feat(bloom): /bloom/progress 実データ化 (v29 テンプレ + API ルート + mock fallback) [dispatch main- No.60]
- push: origin/feature/bloom-6screens-vercel-2026-05 ✅（dc8bc78..1ba0442）

## # Step 1: v29 HTML placeholder 化（before/after 行数）

修正対象: `public/_proto/bloom-dev-progress/index.html`

| 区画 | before（line 範囲） | after | 行数差 |
|---|---|---|---|
| 履歴タブ サンプル 7 日分カード | 8578-8829（252 行） | `<!-- DATA_HISTORY_LIST_START --> ... END -->`（2 行） | -250 |
| モジュール TOC（12 module 目次） | 7542-7582（41 行） | `<!-- DATA_MODULE_TOC_START --> ... END -->`（2 行） | -39 |
| モジュール詳細（12 module カード） | 7587-8511（925 行） | `<!-- DATA_MODULE_DETAIL_START --> ... END -->`（2 行） | -923 |
| **合計** | **9221 行** | **8010 行** | **-1211 行 / +6 マーカー** |

逆順置換（Python script）でライン shift 防止: history → detail → TOC の順で実行。

## # Step 2: API ルート実装

新規: `src/app/api/bloom/progress-html/route.ts`

### 主要関数
| 関数 | 役割 |
|---|---|
| `fetchData()` | Supabase 優先、エラー/空時は MOCK_DATA に自動 fallback。X-Data-Source ヘッダで区別 |
| `buildHistoryHtml(reports, logs)` | root_daily_reports × root_daily_report_logs から日付カード HTML 生成（workstyle pill / 本日の作業 / 明日の予定 / 特記事項） |
| `buildModuleTocHtml(modules)` | root_module_progress から樹冠/地上/地下グルーピング目次生成 |
| `buildModuleDetailHtml(modules)` | 全体進捗バー + 関連 Phase pills + リリース予定 |
| `escapeHtml()` | XSS 防止（&lt; &gt; &amp; &quot; &#39;） |

### Supabase 接続フロー
1. `process.env.MOCK_DATA === "1"` → 強制 mock
2. NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 未設定 → mock
3. fetch error or 全テーブル空 → mock
4. それ以外 → 実データ

### 内蔵 mock データ
- 日報 3 件（2026-04-22 ~ 04-24）
- ログ 12 件（work + tomorrow）
- モジュール 12 件（全 Garden module）

### Response
- Content-Type: text/html; charset=utf-8
- X-Data-Source: mock | supabase
- Cache-Control: no-store

## # Step 3: page.tsx iframe src 変更

修正対象: `src/app/bloom/progress/page.tsx`

| 箇所 | before | after |
|---|---|---|
| iframe src | `/_proto/bloom-dev-progress/index.html` | **`/api/bloom/progress-html`** |
| iframe height | `calc(100vh - 153px)` | （維持、No.58 の修正） |

## # Step 4: ダミーデータでの動作確認結果

| 検証項目 | 結果 |
|---|---|
| GET /api/bloom/progress-html | **HTTP 200**（245ms） |
| GET /bloom/progress（iframe parent） | **HTTP 200**（96ms） |
| Response header `X-Data-Source` | **mock**（Supabase テーブル未作成のため fallback 起動） |
| placeholder マーカー残存数 | **0**（3 マーカー全て replace 済） |
| 履歴カード `gpd-history-card` | **3 件**（mock 4/22, 4/23, 4/24） |
| モジュールカード `gpd-module-card` | **12 件**（全 Garden module） |

## Supabase 接続後の自動切替

5/7 槙さん招待後、Supabase で以下 3 テーブル作成すれば API ルート自動で実データに切替（env 変更不要）:

```sql
-- root_daily_reports: { date date PK, workstyle text, special text }
-- root_daily_report_logs: { id uuid PK, report_date date FK, category text, module text, content text, ord int }
-- root_module_progress: { code text PK, name_jp text, name_en text, percent int, group text, phase_pills text[], phase_active text, release text }
```

各テーブルに 1 行以上データ入れば fallback OFF、Supabase 経路で動作。

## legacy 保持ファイル一覧（削除禁止）
- public/_proto/bloom-dev-progress/index.legacy-template-replace-20260505.html （新規、9221 行版）
- src/app/bloom/progress/page.legacy-iframe-src-change-20260505.tsx （新規）
- src/app/api/bloom/progress-html/route.ts は新規ファイル、legacy 不要

（main- No. 41/42/44/45/48/50/56/58 で作成済 legacy 19 件も継続保持）

## 完了時刻
2026-05-05(火) 20:03（着手 19:57 → 完了 20:03、所要 6 分）

## 検証依頼
a-main-012 で Chrome MCP DOM/視覚検証お願いします:
1. /api/bloom/progress-html HTTP 200 + 動的 HTML 返却（Response header `X-Data-Source: mock` 確認）
2. /bloom/progress iframe 内に動的データ反映:
   - 履歴タブ: 3 日付カード（4/22-24）表示
   - モジュールタブ: 12 module（樹冠 4 + 地上 5 + 地下 3）表示
   - 概要タブ / 設定タブ: v29 静的のまま
3. 5/7 Supabase 接続後、X-Data-Source: supabase に切替確認

## 次の作業（東海林さん 5/8 デモ向け）
1. 5/6 朝〜夜: 視覚調整 + Chatwork 取り込み 9 日分準備（claude.ai 作業日報セッション側）
2. 5/7 朝（槙さん招待後）: Supabase テーブル作成 + 接続テスト
3. 5/7 昼〜夜: 履歴 + モジュールタブ実データ動作確認
4. 5/8 朝: 最終リハ

a-bloom-003 待機中（次 bloom-003- No. 35、main- No. 61 待ち）
~~~
