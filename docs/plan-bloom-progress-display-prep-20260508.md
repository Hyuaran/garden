# /bloom/progress 表示拡張準備 spec

> **起草経緯:** dispatch main- No. 103 §「第三優先 /bloom/progress 表示内容更新準備」+ dispatch main- No. 135 GO 後、a-bloom-004 自走判断で起草（2026-05-08 14:15）。
>
> **目的:** 5/10 a-root-002 集約役 migration 反映時の Bloom 側表示ロジック拡張作業を効率化するため、既存実装の現状把握 + 拡張ポイント候補 + 判断保留事項を事前整理する。
>
> **スコープ:** spec のみ、実装着手は 5/10 a-root-002 migration 反映後（連携依存）。

---

## 1. 既存実装の現状把握

### 1-1. ファイル構成

| ファイル | 役割 | サイズ |
|---|---|---|
| `src/app/bloom/progress/page.tsx` | iframe で `/api/bloom/progress-html` を埋め込み（軽量、修正 minimal）| 753B |
| `src/app/api/bloom/progress-html/route.ts` | テンプレート読込 + Supabase fetch + HTML 動的生成 | 約 750 行 |
| `src/app/api/bloom/progress-html/route.legacy-20260507-bugfix.ts` | 旧版（mapping bugfix 前）| 既存 legacy |
| `public/_proto/bloom-dev-progress/index.html` | v29 テンプレート（base href + placeholder マーカー）| 静的 |
| `src/app/api/bloom/cron/_lib/aggregator.ts` | bloom_daily_logs / bloom_roadmap_entries / bloom_project_progress 集計 | 別系統（cron 配信用）|

### 1-2. データソース（progress-html/route.ts §fetchData）

| テーブル | 用途 | カラム使用 |
|---|---|---|
| `root_daily_reports` | 日報メタ（最大 30 件、最新順）| date / workstyle / is_irregular / irregular_label |
| `root_daily_report_logs` | 日報項目別ログ | report_date / category (work/tomorrow/special) / module / content / ord |
| `root_module_progress` | 12 モジュールの進捗状態 | module / progress_pct / phase / status / summary |

→ Bloom Phase A-1 完成時点で 12 モジュール対応済（root_module_progress: handoff 書 §Supabase 状態 12 行記載）。

### 1-3. 表示構造（v29 テンプレート）

| ブロック | 内容 |
|---|---|
| ヘッダー | Garden 開発進捗 + 最終更新日 |
| 履歴タブ | 直近 30 日の日報一覧（作業・明日・特記）|
| モジュールタブ TOC | 12 モジュール TOC（Bloom / Forest / ... / Rill）|
| モジュール詳細 | 各モジュールの phase_pills + phase_active + percent + summary + release |

### 1-4. mapping ロジック（DB 列名 → TS 型）

`progress-html/route.ts` の `MODULE_META` で 12 モジュールのメタデータマスタ（code / name_jp / name_en / group / release）。`mapDbModule()` で root_module_progress 行を `ModuleProgress` 型に変換。

---

## 2. 5/10 a-root-002 集約役 migration の想定変更点

a-root-002 の migration スコープは現時点で a-bloom-004 未確認。**dispatch main- No. 103 §「マイルストーン表示 / 12 モジュール表示等」記載**から推測:

| 想定変更 | 影響範囲 | 確認方法 |
|---|---|---|
| **マイルストーン定義テーブル追加**（例: `root_milestones`）| 履歴タブ後 / モジュール詳細にマイルストーンセクション追加 | a-root-002 dispatch で migration 内容確認 |
| **root_module_progress カラム追加**（例: `next_milestone_label`, `milestone_due`）| モジュール詳細の phase_active 横に next milestone 表示 | 同上 |
| **12 モジュール完全状態反映**（既存 12 行の更新 + 新規追加）| MODULE_META の release / phase_pills 更新 | a-root-002 が migration 一括反映 |

→ **a-bloom-004 単独で確定できる事項なし**、5/10 集約役 migration 反映後に判断確定。

---

## 3. Bloom 側 表示拡張ポイント候補

### 3-1. MODULE_META 更新（小〜中）

`progress-html/route.ts` 79-91 行目の `MODULE_META`:

| モジュール | 現状 release | 想定更新 |
|---|---|---|
| Bloom | `26/08` | 5/10 集約後に最新化（Phase A-1 完成 + Phase A-2.1 KPI 完成 = 進捗反映）|
| Forest | `稼働中` | B-min 仕訳帳完成（5/9 forest-9 想定）後に「Phase B-min 完成」追加 |
| Bud | `26/06` | Phase 1-3 進捗反映 |
| Tree | `26/09` | Phase D 進捗反映 |
| Leaf | `26/07` | 関電 Phase D-F 進捗反映 |
| Root | `稼働中` | Phase B 進捗反映（5/8-9 a-root-002 着手後）|
| Sprout / Calendar / Fruit | `null` | Phase B spec 起草済 = `26/10` 等の release 想定値追加 |
| Soil | `null` | Batch 16 完成後に release 想定値追加 |
| Rill | `26/10` | 維持 |
| Seed | `null` | 維持（新事業枠）|

### 3-2. マイルストーン表示追加（中〜大）

仮定: a-root-002 が `root_milestones` テーブル追加 + `module / milestone_label / due_date / completed_at` 等のスキーマ定義する場合:

新規追加箇所:
1. `progress-html/route.ts` の type 定義に `Milestone` 追加
2. `fetchData()` に `root_milestones` SELECT 追加
3. `buildHistoryHtml()` or `buildModuleDetailHtml()` にマイルストーンレンダリング追加
4. v29 テンプレートに placeholder `<!-- DATA_MILESTONES_START -->` 追加（または既存 `<!-- DATA_MODULE_DETAIL_START -->` 内に統合）

### 3-3. 12 モジュール TOC 動的生成（小）

現状 v29 テンプレートで TOC を `buildModuleTocHtml(modules)` で生成。マイルストーン追加時は TOC のリンクラベルにマイルストーン件数 badge 追加可能（例: `Bloom (3 milestones)`）。

---

## 4. 判断保留事項（5/10 a-root-002 着手後 確定）

| # | 論点 | 推奨 | 確定タイミング |
|---|---|---|---|
| 1 | マイルストーンテーブルのスキーマ | a-root-002 plan に従う | 5/10 a-root-002 dispatch 受領後 |
| 2 | v29 テンプレート vs React component 化 | iframe 維持（既存稼働で安定）| 即決 |
| 3 | MODULE_META の最新化トリガー | 5/10 集約役 migration 反映と同時 | 5/10 朝 |
| 4 | マイルストーン表示位置 | モジュール詳細内 → 履歴タブ後の 3rd タブ追加検討 | 5/10 a-root-002 確認後 |
| 5 | 既存 cron aggregator との連携 | aggregator は cron 配信専用 = 直接連携不要 | 即決 |

---

## 5. 5/10 着手時の作業手順（事前準備版）

a-root-002 5/10 着手 → migration 完了通知後、Bloom 側で以下を順次実行:

1. a-root-002 の dispatch 内容把握（migration 範囲 + スキーマ確認）
2. `progress-html/route.ts` MODULE_META 更新（3-1）
3. （マイルストーン追加なら）type 定義 + fetchData + render 追加（3-2）
4. v29 テンプレート placeholder 追加（必要に応じ）
5. dev (port 3000) で `/bloom/progress` 視覚確認
6. Vercel 反映待ち + supabase env 確認
7. Chrome MCP 視覚確認 + regression check
8. commit + push + bloom-004- N で完成報告

想定工数: 0.3-0.5d（migration 範囲依存）

---

## 6. 制約遵守確認

dispatch main- No. 103 §「制約遵守」整合:
- ✅ 動作変更なし（既存コードは触らない）= 本 spec は spec のみ、実装着手は 5/10 後
- ✅ 新規 npm install 禁止（既存 supabase-js 流用）
- ✅ Bloom 独自認証独立性維持（progress-html は service role key で読取、authentication 層と独立）
- ✅ 設計判断・仕様変更なし（v29 既存仕様維持、追加分のみ）

---

## 7. 関連 dispatch / commit

- dispatch main- No. 48（2026-05-05）v29 HTML 完成
- dispatch main- No. 60（2026-05-05）progress-html 動的化
- dispatch main- No. 77（2026-05-07）500 修正 + Supabase mapping
- dispatch main- No. 103（2026-05-08）/bloom/progress 表示準備指示
- dispatch main- No. 135（2026-05-08）vitest 解決 + Phase A-2.1 続き GO
