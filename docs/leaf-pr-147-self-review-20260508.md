# PR #147 光回線 最小 skeleton セルフレビュー

> 起草: a-leaf-002
> 起草日時: 2026-05-08(金) 14:50
> 用途: PR #147（光回線 最小 skeleton 起票）の reviewer 視点での精読 + 改善提案
> 関連 dispatch: main- No. 138 dispatch（3 案 4 PR self-review）

---

## 1. レビュー観点（10 観点）

| # | 観点 | 結果 |
|---|---|---|
| 1 | テーブル設計の妥当性 | ✅ + 軽微改善提案 |
| 2 | RLS の安全性 | ✅ A-1c v3.2 準拠 |
| 3 | business_id 連携 | ✅ 整合 |
| 4 | case_id 命名 | ✅ + 提案あり |
| 5 | 残課題の網羅性 | ✅ |
| 6 | 既存 spec との整合 | ✅ 5 PR 横断レビューと整合 |
| 7 | SQL 実行可能性 | ✅ 構文確認済 |
| 8 | 命名一貫性 | 🟡 軽微改善提案 |
| 9 | インデックス効率 | 🟡 改善余地 |
| 10 | 拡張性 | ✅ |

---

## 2. 詳細レビュー

### 2.1 テーブル設計の妥当性 ✅ + 軽微改善提案

`leaf_hikari_cases`（10 業務フィールド）:
- ✅ 必要最小限の構成、Phase B-1 で詳細化する余地を §1.3 で明記
- ✅ 共通メタ（created_at / updated_at / deleted_at / deleted_by）は A-1c と並列
- ✅ status enum で業務状態を限定（pending / contracted / construction_scheduled / construction_completed / opened / cancelled / lost）

**軽微改善提案 #1（Phase B-1 で対応）**:
- `customer_kana` を NOT NULL にすべきか業務判断が必要（現在 nullable）
- `customer_phone` の桁数 / 形式 CHECK 制約（電話番号 10-11 桁）を将来追加検討

**軽微改善提案 #2（Phase B-1 で対応）**:
- `monthly_fee` / `cancellation_fee` の precision (10,2) は妥当だが、業務上小数発生しないなら integer の方が望ましい（東海林さんに確認）

### 2.2 RLS の安全性 ✅ A-1c v3.2 準拠

- ✅ 全 SECURITY 関数で `search_path = ''` 採用（known-pitfalls #9 準拠）
- ✅ `(SELECT auth.uid())` で囲む（PostgreSQL プランナ最適化）
- ✅ public schema 明示修飾（schema poisoning 対策）
- ✅ `leaf_user_in_business('hikari')` で関電と同パターン
- ✅ admin / super_admin は無条件横断（管理操作が可能）
- ✅ DELETE は admin+ のみ（誤削除防止）

**観察**: A-1c で導入された v3.2 セキュリティパターンが完全に踏襲されている、追加リスクなし。

### 2.3 business_id 連携 ✅

- ✅ `leaf_businesses` に `'hikari'` 行追加（INSERT ON CONFLICT DO NOTHING で冪等）
- ✅ `business_id` 列を NOT NULL DEFAULT 'hikari' で hardcode + FK 制約
- ✅ 将来拡張 spec §2.2 の例示（`sb` / `docomo` / `sonet`）と整合

**観察**: 本 spec は A-1c v3 の `business_id` パターンの **2 件目の実装** = 横展開の検証ケース。今後の他商材（クレカ等）の前例として価値高い。

### 2.4 case_id 命名 ✅ + 提案あり

- ✅ K-* (kanden) と H-* (hikari) で衝突回避
- ✅ 形式 `H-YYYYMMDD-NNN` は K-* と並列

**改善提案 #3（Phase B-1 検討事項として spec §8 追加候補）**:
- 連番 NNN の払い出しメカニズムは未定義
- A-1c の K-YYYYMMDD-NNN は同日内で 1 〜 NNN（推測）で払い出されるはず
- hikari の H-YYYYMMDD-NNN も同様の連番 sequence が必要
- Phase B-1 で sequence テーブル or 関数の設計を確定

### 2.5 残課題の網羅性 ✅

spec §8 に 5 項目記載:
- 業務フロー詳細
- キャリア識別
- Kintone 移行
- 解約金計算
- 物件種別

**追加提案 #4**: 以下 3 項目を §8 残課題に追加検討:
- case_id 連番 sequence の設計（前項 #3）
- canclellation 防止（解約阻止フロー）の業務ルール
- A-1c v3.2 添付ロジックの hikari への port 計画（Phase C-1 詳細）

### 2.6 既存 spec との整合 ✅ 5 PR 横断レビューと整合

- ✅ A-1c v3.2 の 6 観点（Phase 配置 / テーブル名 / 共通用語 / 依存関係 / a-review #65 修正 / 設計判断）と整合確認済
- ✅ 将来拡張 spec §2.3 の cross-business unified view パターンに従う
- ✅ TimeTree spec / OCR spec とは独立（光回線の TimeTree / OCR は別 spec で起草）

**観察**: PR #135 のセルフレビュー結果を踏まえた起草、新規矛盾なし。

### 2.7 SQL 実行可能性 ✅ 構文確認済

- ✅ migration SQL は idempotent（IF NOT EXISTS / ON CONFLICT DO NOTHING）
- ✅ 検証クエリをコメント化して spec 末尾に同梱
- ✅ A-1c v3.2 共通基盤を前提として明記（実行順序）

**改善提案 #5**: psql / Supabase Dashboard SQL Editor での実行確認は Phase B-1 着手時に実施。

### 2.8 命名一貫性 🟡 軽微改善提案

`leaf_hikari_cases.sales_company_id` の型が `uuid` だが、A-1c spec の関電案件本体（`soil_kanden_cases`）では `company_id` 列の型を確認する必要あり。

**改善提案 #6**:
- 現 spec では `sales_company_id uuid REFERENCES root_companies(company_id)` だが、A-1c の `soil_kanden_cases` の同等列との整合確認が必要
- 不一致なら align（Phase B-1 着手時に確認）

### 2.9 インデックス効率 🟡 改善余地

現 index 構成:
- `leaf_hikari_cases`: status / sales_user_id / construction_date / deleted_at の 4 index
- `leaf_hikari_attachments`: case_id / category の 2 index

**改善提案 #7（Phase B-2 で対応）**:
- 検索頻度の高い複合 index を追加検討:
  - `(business_id, status)` 複合 index（v_leaf_cases の WHERE 高速化）
  - `(sales_user_id, status, deleted_at)` 複合 index（営業ダッシュボード用）
- ただし最小 skeleton では現 index で十分、Phase B-2 UI 実装時に実測で判断

### 2.10 拡張性 ✅

- ✅ business_id 列で他事業展開対応（クレカ追加時はテーブル名のみ変更）
- ✅ category enum を hikari 専用にすることで業務固有性を維持
- ✅ ocr_processed 列予約済（Phase D-1 OCR 拡張時に活用）
- ✅ archived_tier enum で 3 階層保管（A-1c と並列）

---

## 3. 改善提案サマリ

| # | 種別 | 提案 | 対応タイミング |
|---|---|---|---|
| 1 | 業務 | customer_kana NOT NULL 化検討 | Phase B-1 |
| 2 | 業務 | 金額系列の precision (10,2) → integer 検討 | Phase B-1 |
| 3 | 設計 | case_id 連番 sequence メカニズム定義 | Phase B-1 |
| 4 | spec 追記 | §8 残課題に 3 項目追加（連番 / 解約防止 / port 計画）| 本 PR で対応可 / 別 PR |
| 5 | 実装 | psql / Dashboard 実行確認 | Phase B-1 |
| 6 | 整合 | sales_company_id の型 align（A-1c との比較）| Phase B-1 |
| 7 | パフォーマンス | 複合 index 追加検討 | Phase B-2 |

→ **本 PR で対応すべきもの: なし**（提案 4 のみ spec 追記候補だが、軽微）

→ **Phase B-1 で対応**: 提案 1 / 2 / 3 / 5 / 6（業務ヒアリング + 整合確認）

→ **Phase B-2 で対応**: 提案 7（実装後に実測）

---

## 4. 結論

### 4.1 総合評価

| 観点 | 評価 |
|---|---|
| 設計妥当性 | ✅ A-1c v3.2 共通基盤の正しい踏襲 |
| 安全性 | ✅ search_path / RLS 完全準拠 |
| 整合性 | ✅ 5 PR 横断レビューと整合 |
| 拡張性 | ✅ 他商材展開の前例として価値高い |
| ドキュメント品質 | ✅ §1〜§10 で網羅的、改訂履歴付き |
| a-bloom レビュー準備度 | ✅ 受付可能 |

### 4.2 緊急修正必要事項

→ **なし**。本 PR は現状のまま a-bloom レビューに進めて問題なし。

### 4.3 a-bloom レビュー時の確認推奨ポイント

a-bloom レビュー時、以下を重点確認推奨:

1. **business_id パターンの 2 件目の実装** として違和感がないか
2. **A-1c v3.2 構造の踏襲度** が適切か（命名 / RLS / 添付）
3. **業務フィールドの最小性** が Phase B-1 詳細化で破綻しないか
4. **case_id 連番 sequence** の Phase B-1 設計余地が確保されているか

### 4.4 次セッション（a-leaf-NNN）への引継ぎ事項

Phase B-1 着手時:
1. 東海林さんに業務フロー 5 項目（spec §8）+ 改善提案 1-3 をヒアリング
2. case_id 連番 sequence メカニズム設計（提案 3）
3. A-1c との整合再確認（提案 6）
4. spec / migration を Phase B-1 詳細版に発展（v1.0 → v2.0）

---

## 5. 改訂履歴

| 日付 | 版 | 内容 | 担当 |
|---|---|---|---|
| 2026-05-08 | v1.0 | 初版起草、a-main-014 main- No. 138 dispatch 対応、PR #147 セルフレビュー | a-leaf-002 |

— end of self-review —
