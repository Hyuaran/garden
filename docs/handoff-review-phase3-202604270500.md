# Handoff — a-review Phase 3 (35 PR) レビュー完了

- **発行**: 2026-04-27 05:00
- **担当**: a-review GW セッション
- **依頼元**: a-main-008
- **完了所要**: 約 2 時間（priority 1-2 を直接 + priority 4-5 を 4 並列 agent）

## 📊 全 20 PR 判定サマリ

> 当初依頼の 35 PR のうち、現時点で OPEN かつ未レビューの 20 PR を全件レビュー完了。

| 判定 | 件数 | PR |
|---|---|---|
| ✅ **APPROVE** | **16** | #90 #100 #92 #93 #94 #95 #77 #78 #79 #80 #86 #88 #89 #97 #98 #99 |
| 🟡 **CONDITIONAL APPROVE** | **3** | #96 / #101 / #81 |
| ❌ **REQUEST CHANGES** | **1** | #91 |

🎯 重大度合計: 🔴 **12** / 🟡 **約 30** / 🟢 **約 30**

## 🔴 重大指摘 12 件（マージ前対応推奨）

### 🔴 マージブロッカー

#### PR #91 (bloom ShojiStatus regression test) — REQUEST CHANGES
1. status enum に `"offline"` 混入（spec/migration #90 の `available/busy/focused/away` と不整合）
2. `focused`/`away` のテストカバレッジ 0
3. `garden_role` 型に `outsource` 欠落（known-pitfalls #6 違反）

#### PR #101 (soil Phase B) — CONDITIONAL（5 件）
1. **R-1**: B-04 §4.1 tsvector に暗号化対象 `phone_primary` 平文混入 → **個人情報保護法 第 23 条違反リスク**
2. **R-2**: B-02 §10.2 投入時刻と §13 「土日も人が入る非稼働日なし」前提が矛盾
3. **R-3**: B-06 §6.4「MV → 通常テーブル」と B-04 §6.3/§7.4「MV のまま」が齟齬
4. **R-4**: B-05 §5.5.4 R2→GDrive 移管で SHA256 検証欠落、データ消失リスク
5. **R-5**: B-06 §17.4.1 module_owner_flags 部分 INDEX の EXPLAIN ANALYZE 検証未実施

#### PR #96 (cross-ui 盆栽ビュー) — CONDITIONAL（3 件）
1. PR #93/#95/#96 の同 spec 改訂衝突（merge 順序戦略要決定）
2. 9→12 モジュール拡張の整合不足（Sprout/Calendar/Fruit 実体化未追従）
3. GW 5/5 採用ゲート工数 3.7d + アセット調達クリティカルパス未策定

#### PR #81 (006→007 handoff) — CONDITIONAL（1 件）
1. PR #78 と PR #81 が同 handoff ファイルを新規追加 + Rill モジュール記述が PR #79 と齟齬
   - 推奨 merge 順: **#78 → #79 → #81**（#81 から該当 handoff 除外）

## ⚡ 即マージ可（16 件）

セキュリティ・データ整合性・spec 矛盾なし。**5/5 後道さんデモ前マージで問題なし**：
- bloom CEO migration: #90
- 8-role 化: #92 #93 #100
- cross-ui audit/fix: #94 #95
- a-main / handoff docs: #77 #78 #79 #80
- a-auto broadcast: #86 #88 #89
- 画像生成 prompts: #97 #98
- prework 整理: #99

## 🎯 5/3 期限への見通し

**Phase 1 + 2 + 3 累計**:
- Phase 2 重大 5 件: #82 #83 #84 で APPROVE / #85 #87 で REQUEST CHANGES (修正待ち)
- Phase 3 priority 1-5: 上記 20 件

**修正必要 PR**:
- 🔴 マージブロッカー 4 件: #85 #87 #91 + (#101 の R-1 個人情報リスク)
- 🟡 CONDITIONAL 3 件 (merge 順序調整): #96 #101 #81

**5/3 までの工数見積**:
- #91 修正（test 型 + outsource 追加）: 1 時間
- #101 R-1 修正（tsvector から phone_primary 除外）: 30 分
- #85 修正（4 件、a-bud session）: 1〜2 時間
- #87 修正（NEW.id Trigger 引数化）: 1 時間
- #96 #101 #81 merge 順序確定: 東海林さん判断

合計 4-5 時間程度の作業 → **GW 中盤 5/3 まで余裕あり**。

## 関連ファイル

- レビュー本文（全件）: `.review-tmp/review-*.md`（最新の Phase 3 分は新規追加）
- 投稿済 GitHub コメント: 各 PR の `#issuecomment-432*` 参照（handoff 詳細表に URL 列挙）
- ブランチ: `feature/review-bloom-shoji-status-20260426`

## 次セッションへの引継

a-review は次のレビュー依頼まで待機モード。新規 PR 発行や修正 PR 再レビュー依頼があれば即対応可能。

---

🤖 a-review GW セッション by Claude Opus 4.7 (1M context)
