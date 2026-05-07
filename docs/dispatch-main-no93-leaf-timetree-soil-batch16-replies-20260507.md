# dispatch main- No. 93 — 2 セッション一括返答（leaf-002 # 3 TimeTree 6 論点 全 OK / soil-39 残作業 GO）

> 起草: a-main-013
> 用途: a-leaf-002 # 3 TimeTree 6 論点 全暫定提案 OK / a-soil 残作業（Index #05 + Phase B-01）継続 GO
> 番号: main- No. 93
> 起草時刻: 2026-05-07(木) 19:06

---

## 投下用短文 A（東海林さんが a-leaf-002 にコピペ）

~~~
🟢 main- No. 93
【a-main-013 から a-leaf-002 への dispatch（# 2 完成 評価 + # 3 TimeTree 6 論点 全 OK）】
発信日時: 2026-05-07(木) 19:06

leaf-002-7 受領、# 2 Phase A prep 25 分完成 + PR 3 件発行 = 想定の 4 倍速。

詳細は以下ファイル参照:
[docs/dispatch-main-no93-leaf-timetree-soil-batch16-replies-20260507.md](docs/dispatch-main-no93-leaf-timetree-soil-batch16-replies-20260507.md)

## # 3 TimeTree 6 論点 全 OK（暫定提案採用）

| # | 論点 | 採用 |
|---|---|---|
| 1 | 移行戦略: **B 半自動**（CSV エクスポート + 手動アップロード支援 UI）| ✅ |
| 2 | Phase 配置: **B-2**（A-1c v3 添付機能完成後、関電業務委託のみで先行）| ✅ |
| 3 | TimeTree API rate limit 調査: **不要**（半自動方式なら API 不使用）| ✅ |
| 4 | import 範囲: **関電業務委託のみ + 直近 2 年**（容量制限考慮）| ✅ |
| 5 | カテゴリ自動判定: **手動**（CSV 編集でアップロード前に整備）| ✅ |
| 6 | 並行運用期間: **1 ヶ月**（β版運用との重複期間）| ✅ |

→ # 3 TimeTree spec 起草を継続。論点さらに発生したら都度 leaf-002-N で。

## # 3 完走後 → # 4 OCR spec 起草へ

leaf-002-5 計画通り、# 3 完走後に # 4 OCR spec 起草着手。事前承認方針継続:
- エンジン選定（Tesseract / Google Vision / Azure CV）
- 課金影響
- Phase 配置
- 対象帳票

# 4 起草段階で論点上げ → 即回答 → 即継続。

## PR 3 件 状態（記録）

| PR # | 内容 | 状態 |
|---|---|---|
| #130 | spec/plan v3.2 改訂（a-review #65 反映）| OPEN |
| #131 | 将来拡張 設計指針 spec | OPEN（ghost PR 回避 -pr サフィックス）|
| #132 | Phase A 着手前 準備ガイド | OPEN |

レビューは 5/8 以降の a-bloom 余力次第（Leaf は 5/14-16 デモ対象外、品質優先）。

完走 / 区切り報告は leaf-002-N（次番号）で。
~~~

---

## 投下用短文 B（東海林さんが a-soil にコピペ）

~~~
🟢 main- No. 93
【a-main-013 から a-soil への dispatch（Batch 16 第 2 弾 完走 評価 + 残作業継続 GO）】
発信日時: 2026-05-07(木) 19:06

soil-39 受領、Batch 16 第 2 弾 完走 + Vitest 31 ケース全 GREEN + 1,491 insertions = 圧倒的成果。残作業継続 GO です。

詳細は以下ファイル参照:
[docs/dispatch-main-no93-leaf-timetree-soil-batch16-replies-20260507.md](docs/dispatch-main-no93-leaf-timetree-soil-batch16-replies-20260507.md)

## Batch 16 進捗（6/8 完成、評価高）

| spec | 状態 |
|---|---|
| #01 リスト本体スキーマ | ✅ 20260507000001 |
| #02 コール履歴 | ✅ 20260507000002 |
| #03 関電 Leaf 連携 | ✅ 20260507000004 |
| #06 RLS | ✅ 20260507000003 |
| #07 削除パターン | ✅ helpers 実装済 |
| #08 API 契約 | ✅ soil-types.ts |
| #04 インポート戦略 | ⏳ Phase B-01 で実装 |
| #05 インデックス性能 | ⏸️ 残 |

## 残作業継続 GO

| 順 | タスク | 工数 |
|---|---|---|
| 1 | **#05 Index 性能 migration**（FTS / pg_trgm 詳細）| 1.0d |
| 2 | handle_pd_number_change() Server Action（B-03 §6）| 0.3d |
| 3 | Phase B-01 リストインポート skeleton + tests | 1.5d（5/11-12 想定）|

ガンガンモードで連続着手 OK。判断保留出たら即 soil-N で a-main-013 経由。

## ガンガン自走判断 評価

soil-39 §「ガンガンモード自走判断したもの」の 3 点（MV を RLS migration に統合 / case_type CHECK の段階的適用 / Kanden 加算的のみ）はすべて妥当な判断。継続して自走判断で進めて OK。

## 注意点（記録）

- 4 migrations apply は東海林さん別途承認後（CLAUDE.md ルール継続）
- B-01 バックフィル完走後に soil_list_id NOT NULL 化が別 migration で必要
- soil_lists_assignments MV は leaf_kanden_cases.soil_list_id 列追加後に意味のあるデータが入る

完走 / 区切り報告は soil-N（次番号）で。
~~~

---

## 1. 背景

### 1-1. 2 セッション同時受領（19:55）

| セッション | 内容 |
|---|---|
| a-leaf-002 | leaf-002-7: # 2 Phase A prep 25 分完成 + PR 3 件 OPEN + # 3 TimeTree spec 着手宣言 |
| a-soil | soil-39: Batch 16 第 2 弾完走（RLS + Kanden + helpers TDD + 31 tests GREEN）|

### 1-2. 私の即判断（推奨採用）

| 案件 | 判断 |
|---|---|
| a-leaf-002 # 3 TimeTree 6 論点 | 全暫定提案 OK = a-leaf-002 自走継続 |
| a-soil 残作業継続（Index #05 + Phase B-01）| 継続 GO（main- No. 91 で承認済の延長）|

---

## 2. a-leaf-002 詳細

### 2-1. # 2 Phase A prep 評価

- 25 分完成（見積 1.5h、**3.6 倍速**）
- 194 行ガイド（9 セクション、独立ガイド）
- PR #132 OPEN

### 2-2. # 3 TimeTree 6 論点 全 OK 理由

| # | 論点 | OK 理由 |
|---|---|---|
| 1 | B 半自動 | 自動は API 制限懸念、手動は工数大、半自動が現実的 |
| 2 | Phase B-2 | A-1c v3 添付完成後の自然な次フェーズ |
| 3 | API rate limit 不要 | B 半自動なら API 使わない |
| 4 | 関電業務委託のみ + 直近 2 年 | 容量制限考慮、現実的スコープ |
| 5 | カテゴリ手動 | TimeTree タグ → mapping 自動は精度低、手動が確実 |
| 6 | 1 ヶ月並行 | β版運用との重複期間として妥当 |

### 2-3. PR 3 件 状態

5/8 以降の a-bloom レビュー待ち。Leaf は 5/14-16 デモ対象外 = レビュータイミング自由。

### 2-4. ghost PR 回避策（記録）

`feature/leaf-future-extensions-spec` で「PR exists」エラー → `-pr` サフィックス追加で回避。a-leaf 既存パターン（`feature/leaf-a1c-task-d1-pr` 等）と同。

---

## 3. a-soil 詳細

### 3-1. Batch 16 第 2 弾 評価

- 30 分で 1.0d 想定の soil-helpers.ts 完走（**16 倍速**）
- 累計 1,491 insertions、2 commits、31 tests GREEN
- Batch 16 進捗 6/8（残 #04 + #05、ただし #04 は Phase B-01 で実装）

### 3-2. 残作業（main- No. 91 で承認済の延長）

| 順 | タスク | 工数 |
|---|---|---|
| 1 | #05 Index 性能 migration（FTS / pg_trgm 詳細）| 1.0d |
| 2 | handle_pd_number_change() Server Action（B-03 §6）| 0.3d |
| 3 | Phase B-01 リストインポート skeleton + tests | 1.5d（5/11-12 想定）|

### 3-3. ガンガン自走判断 評価

soil-39 §「ガンガンモード自走判断したもの」3 点全て妥当:
- MV を RLS migration に統合（依存関係明示）
- case_type CHECK の段階的適用（既存データ NULL 考慮）
- Kanden 加算的のみ（ロールバック容易性）

→ 継続して自走判断で進めて OK。

### 3-4. 注意点（記録）

- 4 migrations apply 東海林さん承認後
- B-01 バックフィル完走後に soil_list_id NOT NULL 化（別 migration）
- soil_lists_assignments MV は Kanden link 列追加後に有効データ入る

---

## 4. dispatch counter / 後続予定

- a-main-013: main- No. 93 → 次は **94**（counter 更新済）

---

## 5. 関連 dispatch / 並行進行

| dispatch | 状態 |
|---|---|
| main- No. 91（4 セッション返答）| 投下中 / 完了 |
| main- No. 92（Bud UI v2 整理移送 a-bud 自走）| 投下中 / 完了、配置先 A/B 確認待ち |
| **main- No. 93（本書、leaf + soil 返答）** | 🟢 投下中 |

並行起動中:
- Plan agent: 5/13 統合テスト計画 spec 起草（背景実行）

---

ご確認・ガンガン継続お願いします。判断保留即上げ歓迎です。
