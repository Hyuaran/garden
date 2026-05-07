# Leaf 5 PR 横断セルフレビュー（2026-05-07）

> 起草: a-leaf-002
> 起草日時: 2026-05-07(木) 21:05
> 用途: a-main-013 main- No. 86 全前倒し dispatch # 1〜# 4 で発行した 5 PR の横断整合確認
> 対象 PR: #130 / #131 / #132 / #133 / #134

---

## 1. 対象 PR 一覧

| PR # | タイトル | base / head | 役割 |
|---|---|---|---|
| **#130** | A-1c spec/plan v3.2 改訂 | develop ← feature/leaf-a1c-spec-v3.2 | a-review #65 セキュリティ修正反映、後続全 spec の前提 |
| **#131** | 将来拡張 設計指針 spec | develop ← feature/leaf-future-extensions-spec-pr | Kintone #22 反映、Leaf 全体の事業スコープ設計指針 |
| **#132** | Phase A 着手前 準備ガイド | develop ← feature/leaf-phase-a-prep | Phase A 9 task の test plan + skeleton 整理 |
| **#133** | TimeTree 移行 設計書 | develop ← feature/leaf-timetree-migration-spec | Phase B-2、半自動方式、6 論点全 OK |
| **#134** | OCR 自動化 設計書 | develop ← feature/leaf-ocr-spec | Phase C、Google Vision API、3 段階展開、7 論点全 OK |

---

## 2. 横断整合チェック 結果サマリ

| 観点 | 結果 |
|---|---|
| Phase 配置整合性 | ✅ 整合 |
| テーブル名 / 列名整合性 | ✅ 整合 |
| 共通用語整合性 | ✅ 整合 |
| 依存関係グラフ整合性 | ✅ 整合 |
| a-review #65 修正の伝播 | ✅ 整合 |
| 設計判断採択結果の整合性 | ✅ 整合 |
| 用語の混乱リスク | 🟡 軽微（後述で改善提案）|

→ **5 PR は merge 可能な品質に達している**。a-bloom レビューに自信を持って委ねられる。

---

## 3. 詳細チェック

### 3.1 Phase 配置整合性 ✅

5 PR の Phase 配置を時系列で整理：

```
[Garden 全体 §18 Phase B（事務業務効率化）配下の Leaf 関電業務委託 タイムライン]

Phase 0: 承認 + テスト基盤セットアップ（A-1c v3.2、PR #130 完成）
   ↓
Phase D: 共通基盤 13/14 task（PR #65〜#73）★ 現在 a-bloom レビュー待ち
   ↓
Phase A: Backoffice UI 9 task（PR #132 で着手前ガイド完備）★ 未着手
   ↓
Phase B: Input UI 3 task（A-1c v3.2 plan に詳細）★ 未着手
   ↓
Phase F: 仕上げ 5 task ★ 未着手
   ↓
─────── A-1c v3.2 完成 ───────
   ↓
Phase B-2: TimeTree 移行（PR #133）★ 未着手、見積 2.5d
   ↓
─────── 並行運用 1 ヶ月 ───────
   ↓
Phase C: OCR 自動化（PR #134）★ 未着手、見積 3.5d
   ↓ 第 1 段階受領書 → 第 2 段階メーター → 第 3 段階手書き（採用可否判定）
```

**チェック結果**: 各 spec が前提とする「先行 Phase 完成」が論理的に矛盾せず、Phase 配置は整合。

### 3.2 テーブル名 / 列名整合性 ✅

5 PR で言及されるテーブル / 列の命名規則：

| テーブル | 定義 PR | 拡張 PR | 用途 |
|---|---|---|---|
| `leaf_kanden_attachments` | PR #58 (A-1c v3) | PR #130 (v3.2) / PR #133 (TimeTree migration_*列) / PR #134 (ocr_*列) | 添付本体 |
| `leaf_businesses` | PR #65 (Task D.1) | - | 事業マスタ |
| `leaf_user_businesses` | PR #65 (Task D.1) | - | ユーザー事業所属 |
| `leaf_kanden_attachments_history` | PR #65 (Task D.1) | - | 変更履歴 |
| `leaf_kanden_attachments_ocr_results` | PR #134 (新規) | - | OCR 結果履歴 |
| `leaf_kanden_attachments_ocr_queue` | PR #134 (新規) | - | OCR 処理キュー |

**命名規則**:
- prefix `leaf_kanden_*` = 関電業務委託専用（将来横断化は将来拡張 spec §2.3 で別途検討）
- prefix `leaf_*` (kanden なし) = 事業横断的（`leaf_businesses` / `leaf_user_businesses` / `leaf_user_in_business()`）
- suffix `_history` / `_results` / `_queue` = 親テーブルの付属用途

**チェック結果**: 命名規則は一貫、衝突や混乱なし。

### 3.3 共通用語整合性 ✅

5 PR を横断する 6 用語の使い分け：

| 用語 | 定義 PR | 各 PR での扱い |
|---|---|---|
| **8 ロール** (toss / closer / cs / staff / outsource / manager / admin / super_admin) | Root A-3-g + PR #130 §1.5 | TimeTree (admin+ 限定) / OCR (admin+ 限定 + 添付閲覧権限保持者) で参照 |
| **3 bucket** (recent / monthly / yearly) | PR #130 §2 | TimeTree (recent + monthly 振分、yearly は対象外) / OCR (bucket 不使用) |
| **`business_id = 'kanden'`** | PR #131 §2.1 + PR #130 § 2.6 | 全 PR で前提として継承 |
| **`leaf_user_in_business(biz_id)`** | PR #130 § 2.3 | TimeTree / OCR で RLS パターン継承（同一関数を再利用） |
| **`is_user_active()`** | Root A-3-g | 全 PR で前提（contract_end_on 制御） |
| **`garden_role_of(uid)`** | Root A-3-g | 全 PR で RLS / 権限判定に使用 |

**チェック結果**: 共通用語は Root A-3-g + A-1c v3.2 を base として 5 PR 全体で継承、不整合なし。

### 3.4 依存関係グラフ整合性 ✅

5 PR の依存関係を有向グラフで表現：

```
                     ┌─────────────────────────────────┐
                     │ Root A-3-g (PR 既 merge 済 ✅)   │
                     │ is_user_active / garden_role_of │
                     └────────────┬────────────────────┘
                                  │ 前提
                                  ↓
   ┌──────────────────────────────────────────────────┐
   │ A-1c v3 共通基盤 (PR #65〜#73、a-bloom レビュー待ち) │
   │ leaf_businesses / leaf_user_in_business /        │
   │ leaf_kanden_attachments + history                │
   └────────────┬─────────────────────────────────────┘
                │ 前提
                ↓
   ┌──────────────────────────────────────────────────┐
   │ PR #130: spec/plan v3.2 改訂 (a-review #65 反映) │
   │ 後続全 spec が参照する正本                         │
   └────────┬───────┬───────┬───────┬─────────────────┘
            │       │       │       │
            ↓       ↓       ↓       ↓
       PR #131  PR #132  PR #133  PR #134
       将来拡張  Phase A   TimeTree   OCR
       指針     prep      Phase B-2  Phase C
```

**チェック結果**: 各 PR の参照関係が一貫、循環依存なし。

### 3.5 a-review #65 修正の伝播 ✅

a-review #65 セキュリティ修正（commit `4247005`）の影響箇所を 5 PR で確認：

| PR | 修正反映箇所 |
|---|---|
| **#130** | 主要箇所（spec §3.5.3 / §3.5.5 / §4.2 / §5.1 / §5.2 / §8 + plan Tech Stack / Task A.7 / npm 承認 / commit メッセージ + v3.2 改訂履歴セクション）|
| **#131** | A-1c v3 を「先行実装例」として参照、search_path 関連は本 spec のスコープ外（経費系）|
| **#132** | §6 で v3.2 改訂による Phase A 影響点を明示（bcryptjs 不要化 / 平文 PW 直送 / npm 承認 10→8）|
| **#133** | §1 / §7 で「A-1c v3.2 添付機能完成後に着手」と明記、内容は v3.2 を前提 |
| **#134** | §1 / §9 で「A-1c v3.2 + B-2 TimeTree 完成後」と明記、内容は v3.2 を前提 |

**チェック結果**: a-review #65 修正は PR #130 を起点に全 PR に正しく伝播。

### 3.6 設計判断採択結果の整合性 ✅

dispatch で採択された判断の各 spec への反映：

**TimeTree 6 論点（main- No. 93 全 OK）**:

| # | 採択 | PR #133 反映箇所 |
|---|---|---|
| 1 | B 半自動 | §1.2 + §3.1 全体フロー |
| 2 | Phase B-2 | ヘッダー + §1.1 |
| 3 | API rate limit 不要 | §1.3（スコープ外） |
| 4 | 関電 + 直近 2 年 | §1.2 + §2 データ変換範囲 |
| 5 | 手動カテゴリ判定 | §3.1 Step 2 |
| 6 | 1 ヶ月並行運用 | §5.1〜§5.2 |

**OCR 7 論点（main- No. 95 全 OK）**:

| # | 採択 | PR #134 反映箇所 |
|---|---|---|
| 1 | Google Vision API | ヘッダー + §1.2 + §2.2 + §8.3 |
| 2 | 月 $10 予算 | §1.2 + §8.1 |
| 3 | Phase C | ヘッダー + §1.1 |
| 4 | 3 段階展開 | §1.2 + §4 全体 |
| 5 | ocr_text 列 + 履歴 | §3.1 + §3.2 |
| 6 | バックグラウンド B 案 | §2.1 + §6.2 + §3.3 (queue) |
| 7 | 80% 信頼度 | §1.2 + §5.1 + §7 |

**チェック結果**: 採択された全 13 論点が漏れなく spec に反映。

### 3.7 用語の混乱リスク（軽微改善提案）🟡

**観察**: "Phase A/B/C/D" という表記が 2 つの異なる文脈で使われており、読者が混乱する可能性あり：

| 文脈 | Phase A | Phase B | Phase C | Phase D |
|---|---|---|---|---|
| **Garden 全体（CLAUDE.md §18）** | 経理総務（Bud / Forest / Root）| 事務業務（Leaf / Bud 給与）| 補完（Soil / Bloom / Rill / Seed / Leaf 他商材）| Tree 最終段階 |
| **Leaf A-1c 内部** | Backoffice UI | Input UI | (使われない) | 共通基盤 |

**改善提案** (将来 spec で適用、本回 PR は変更不要):
- Garden 全体 Phase は「Garden Phase B」のように prefix 追加
- Leaf A-1c 内部 Phase は「A-1c Phase A」のように prefix 追加
- TimeTree spec の「Phase B-2」も「Leaf Phase B-2」（Garden 全体 Phase B 配下の Leaf 第 2 サブフェーズ）と明示すると曖昧性解消

→ 本回 PR では既存の慣習に従って「Phase A/B/C/D」表記を継続。次回 spec 起草時に prefix 採用検討。

---

## 4. 各 PR の品質評価

### 4.1 PR #130: spec/plan v3.2 改訂

| 観点 | 評価 |
|---|---|
| 改訂理由の明確性 | ✅ a-review #65 セキュリティ修正反映が冒頭に明記 |
| 改訂範囲の網羅性 | ✅ spec / plan の関連箇所を全て改訂（grep 結果と照合済） |
| 実コードとの整合 | ✅ commit `4247005` の修正内容を spec / plan に正確に反映 |
| 影響範囲の透明性 | ✅ 見積 6.7d → 6.7d 変更なしを明記 |
| ドキュメントスタイル | ✅ 既存 v3 の改訂方式を踏襲、改訂履歴セクション追加 |

### 4.2 PR #131: 将来拡張 設計指針 spec

| 観点 | 評価 |
|---|---|
| 起草根拠の明確性 | ✅ a-main 006 Kintone 解析 §3.5 #22 を起点として明記 |
| A-1c v3 との整合 | ✅ A-1c v3 を「先行実装例」と位置付け、矛盾なし |
| 将来 business_id 値の例示 | ✅ sb / docomo / sonet を仮例として提示 |
| 横断テーブル設計指針 | ✅ business_id 列 + leaf_user_in_business パターンを明示 |
| ghost PR 衝突回避 | 🟡 `-pr` サフィックス迂回（運用上の理由、本質的 issue なし） |

### 4.3 PR #132: Phase A 着手前 準備ガイド

| 観点 | 評価 |
|---|---|
| 内容網羅性 | ✅ 9 セクション（概要 / チェックリスト / Task 一覧 / skeleton / 認証 / v3.2 影響 / GO 判定 / リンク / 履歴）|
| Task の test plan サマリ | ✅ 9 task の主要 props / RTL 検証 / 工数 / 関連 plan 行を表形式 |
| 着手判断の自動化 | ✅ Step 1〜5 の GO 判定フロー（PR merge / migration / npm install / 認証完成）|
| 認証統一方針反映 | ✅ B 案承認内容（main- No. 85）を §5 で明示 |
| v3.2 改訂影響反映 | ✅ §6 で bcryptjs 不要化 / 平文 PW 直送を明示 |

### 4.4 PR #133: TimeTree 移行 設計書

| 観点 | 評価 |
|---|---|
| 6 論点採択の反映 | ✅ 全 6 論点が spec の各セクションに正確に反映 |
| 半自動方式の処理フロー | ✅ §3.1 で 8 step の全体フロー、§3.2-3.3 でコンポ構成 |
| 並行運用 1 ヶ月の運用ルール | ✅ §5.1-5.2 で運用ルール + 終了判定 4 基準を明示 |
| 残課題の明示 | ✅ §8 で TimeTree CSV 実列名 / DL 方法 / User mapping を明記 |
| 既存パターンの継承 | ✅ A-1c v3 共通基盤（attachments / image-compression）の再利用範囲を明示 |

### 4.5 PR #134: OCR 自動化 設計書

| 観点 | 評価 |
|---|---|
| 7 論点採択の反映 | ✅ 全 7 論点が spec の各セクションに正確に反映 |
| Google Vision API 選定根拠 | ✅ §1.4 で他社（Tesseract / Azure / AWS）との比較 |
| 3 段階展開の運用設計 | ✅ §4 で各段階の対象 / 信頼度想定 / 着手時期を明示 |
| 課金管理の安全性 | ✅ §8.1 で月予算 $10 + 80% / 100% alert + 自動停止を設計 |
| バックグラウンド処理アーキ | ✅ §2.1 全体フロー + §3.3 ocr_queue + Edge Functions 5 分間隔 cron |
| 信頼度しきい値 80% の UX | ✅ §5.1 で 80% 以上 / 未満の表示分岐を視覚的に明示 |

---

## 5. レビュー結論

### 5.1 総合評価

| 観点 | 評価 |
|---|---|
| 横断整合性 | ✅ 5 PR は相互に整合 |
| 個別品質 | ✅ 各 PR は単体で完結した品質 |
| 設計判断トレーサビリティ | ✅ dispatch 採択結果が漏れなく反映 |
| 実コードとの整合 | ✅ a-review #65 修正は正確に伝播 |
| a-bloom レビュー準備度 | ✅ レビュー受付可能、議論箇所は a-bloom 観点で再検討 |

### 5.2 a-bloom レビュー時の留意点

a-bloom が以下の観点でレビューする際の参考：

1. **コードレビュー観点**
   - PR #130 のコード変更（実コード）は migration ファイル（既 commit `4247005`）の同期確認のみ。実コード差分は spec / plan 文書のみ
   - PR #131 / #133 / #134 はすべて新規 spec ファイル、実コード差分なし
   - PR #132 は新規 prep ガイド、実コード差分なし

2. **文書整合性観点**
   - 5 PR の merge 順序推奨: **#130 → #131 → #132 → #133 → #134**
   - PR #132 は #130 から派生、PR #133 / #134 は develop ベース
   - PR #131 は `-pr` サフィックス迂回ブランチ（ghost PR 衝突回避）

3. **設計判断レビュー観点**
   - TimeTree / OCR の採択論点（合計 13 件）は dispatch で東海林さん承認済
   - 設計の妥当性 / 技術選定 / 工数見積の合理性をレビュー
   - 課金影響（OCR $10/月）は予算妥当性のみレビュー（安全装置は §8.1 に設計済）

### 5.3 改善余地

本セルフレビューで検出した改善余地（**本回 PR は変更不要**、次回 spec 起草時に適用）:

1. **Phase 表記の prefix 化** (§3.7): "Phase A" → "Garden Phase B" / "Leaf A-1c Phase A" の使い分けで曖昧性解消
2. **OCR コスト換算式の明示** (PR #134): "$1.5/1000 page" → "1 page = 1 画像" の前提を §8.1 に明記すると親切
3. **TimeTree 移行の進捗管理 UI** (PR #133): 移行件数 / 失敗件数の管理者ダッシュボード（OCR と同様）を §5 に追加検討

### 5.4 緊急修正が必要な事項

→ **なし**。5 PR は現状のまま a-bloom レビューに進めて問題なし。

---

## 6. 改訂履歴

| 日付 | 版 | 内容 | 担当 |
|---|---|---|---|
| 2026-05-07 | v1.0 | 初版起草、a-main-013 main- No. 98 dispatch A 着手、5 PR 横断セルフレビュー完了 | a-leaf-002 |

— end of cross-spec review —
