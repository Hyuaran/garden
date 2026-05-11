# RTK 累計削減トラッキング（main 集約）- 2026-05-08(金) 13:05 開始

> 起草: a-main-014
> 用途: §22-7 引っ越し時 RTK 集計報告の累計記録、東海林さんへの定期報告ベース
> 運用: main / モジュール各セッションは引っ越し時に `rtk gain` 結果を main へ dispatch、main が本ファイルに追記
> 関連: [docs/rtk-cross-modules-aggregation-20260507.md](docs/rtk-cross-modules-aggregation-20260507.md)（5/7 9/9 応答スナップショット、初期値）

---

## 1. 累計トラッキング表（引っ越し毎に追記）

| # | 日時 | セッション | event | commands | input tok | output tok | saved (%) | exec time | 備考 |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 2026-05-07 21:30 | a-soil / a-forest-002 / a-leaf-002 / a-review / a-auto-004 / a-root-002 / a-bud / a-bloom-004 / a-tree | broadcast 集計（baseline）| 799〜838 | 745K-750K | 260K-263K | 487-489K (65.1〜65.3%) | 205m05s〜205m22s | 9 セッション応答済、global scope |
| 1 | 2026-05-08 13:13 | a-bud | **🔴 80% 最終引っ越し実行** | **1,155** | 890.5K | 316.1K | **576.5K (64.7%)** | 208m08s | bud-20、a-bud-002 へ引き継ぎ、handoff 27a4ff2 push 済 |
| 2 | 2026-05-08 13:19 | a-tree-002 | 参考値（引っ越し前、通常モード継続中）| 1,172 | 1.0M | 429.0K | 578.4K (57.5%) | 208m14s | tree-17、参考報告（60% 未到達）|
| 3 | 2026-05-08 14:00 | a-bud-002 | Phase D 100% 完走時報告 | 1,262 | 1.1M | 487.4K | **650.4K (57.3%)** | 208m51s | bud-21、a-bud → bud-002 累計 14 件 / Phase D 100% / 544 tests |
| 3 | TBD | TBD | a-main-014 50% アラート | TBD | TBD | TBD | TBD | TBD | 50% 到達時 baseline |
| 4 | TBD | TBD | a-main-014 引っ越し時 | TBD | TBD | TBD | TBD | TBD | 引っ越し直前、main- No. NNN で報告 |

---

## 2. 期間別サマリ（引っ越し毎に算出）

### 2-1. 5/6 〜 5/7（ガンガン常態モード初日）

- 期間: 2026-05-06 〜 2026-05-07（約 2 日）
- 削減トークン: 476.3K（global scope、handoff 報告）
- 削減率: 64.9%
- ハイライト:
  - a-bud: 9 件完走 / 329 tests / 62% 圧縮
  - a-soil: Batch 16 + Phase B-01 第 1 弾、13 倍速
  - a-bloom-004: 8 件完走、6 倍速
  - a-leaf-002: 5 PR、61% 短縮

### 2-2. 5/8（金）〜 a-main-014 引っ越しまで（暫定）

- 期間: 2026-05-08 12:14（朝起動）〜 引っ越し時
- 削減トークン: TBD（次回更新時に確定）
- 削減率: TBD
- ハイライト:
  - a-bud: D-04 + D-10 完走（Phase D 75% 達成）
  - a-soil: Phase B-01 6/7 段階（Orchestrator + Server Actions 完走）
  - a-leaf-002: Phase D 8 PR 再発行（#138-#145）+ #131 conflict 解消
  - a-tree: PR #146 spec D-02 §3.6 修正
  - a-root-002: PR #136/#137 発行 + plan +191 行

---

## 3. セッション別貢献度（累計、引っ越し毎に追記）

| セッション | 累計 commands | 累計 saved tok | 累計引っ越し回数 | 平均削減率 |
|---|---|---|---|---|
| a-main-013 + 014 | TBD | TBD | TBD | TBD |
| a-bud | TBD | TBD | TBD | TBD |
| a-soil | TBD | TBD | TBD | TBD |
| a-bloom-004 | TBD | TBD | TBD | TBD |
| a-leaf-002 | TBD | TBD | TBD | TBD |
| a-tree（旧）/ a-tree-002 | TBD | TBD | TBD | TBD |
| a-forest-002 | TBD | TBD | TBD | TBD |
| a-root-002 | TBD | TBD | TBD | TBD |
| a-review | TBD | TBD | TBD | TBD |
| a-auto-004 | TBD | TBD | TBD | TBD |

→ global scope の `rtk gain` を各セッションで実行することで、累計値はほぼ同じになる（同一マシン 1 binary）。
→ 質的観察（セッション固有の hot path / 体感）を §4 で別途集約。

---

## 4. セッション別 体感観察（引っ越し時の所見）

### 5/7 broadcast 時点（baseline）

| セッション | 体感 |
|---|---|
| a-bud | Phase D 9 件 / 27 commits（rtk git commit 64 回 / 95.8%）+ 329 tests（rtk vitest run 99.7%）+ rtk lint eslint 99.6% で **62% 圧縮の基盤** |
| a-soil | Phase B-01 第 1 弾を約 13 倍速で完走、`rtk read` `rtk grep` `rtk git commit` で効いた |
| a-leaf-002 | 6 PR 発行（git commit/push/fetch/branch 多用）= **61% 短縮の主要因実感** |
| a-tree | PR #128/#129 review 待ち、PR reissue で 5 分/件 |
| a-bloom-004 | Phase 1+3+2A+2B 等 8 件 / 6 倍速の主要因実感 |
| a-forest-002 | Phase B-min #4 弥生 CSV パーサー着手中、`rtk vitest run` 99.7% 削減が TDD ループに効く |
| a-root-002 | git / vitest / read / grep / lint 系がほぼ全て RTK 経由で透過処理 |
| a-review | PR レビュー（diff/read/grep/lint）の頻出コマンドが上位独占、**RTK 恩恵 特大** |
| a-auto-004 | Phase 残 A 50+ PR 操作 + spec 修正 + self-review で hot path 効果最大化 |

---

## 5. 東海林さんへの報告履歴（main 引っ越し時 必須）

| # | 報告日時 | 報告 main | 期間 | 累計削減 | 削減率 | 備考 |
|---|---|---|---|---|---|---|
| 0 | 2026-05-07 21:30 | a-main-014 | 5/6-5/7 | 476.3K | 64.9% | 9/9 全 active セッション応答済（baseline 初期報告）|
| 1 | TBD | a-main-NNN | TBD | TBD | TBD | a-main-014 引っ越し時の累計報告 |

---

## 6. 月次 / 週次サマリ（main 引っ越し時 + 月初 自動実施）

### 5 月（5/1-5/31）

- 5/6-7（baseline）: 476.3K 削減（64.9%）
- 5/8 〜 5/14-16 デモ: TBD（5/14-16 デモ前に集計）
- 5/15 〜 5/31: TBD

### 累計

- TBD（main 引っ越し時に算出）

---

## 7. 関連 docs

- [CLAUDE.md §22-7](#) — 引っ越し時 RTK 集計報告ルール
- [docs/rtk-cross-modules-aggregation-20260507.md](docs/rtk-cross-modules-aggregation-20260507.md) — 5/7 9/9 応答スナップショット
- handoff-a-main-013-to-014-20260507.md — 5/6-7 baseline 記録
- C:/Users/shoji/.claude/RTK.md — RTK 操作リファレンス

---

## 8. 運用ルール（再掲）

### 各セッションの責務

- 引っ越し時に `rtk gain` 実行 → 結果を dispatch で main に報告
- a-main 系統: 50% / 引っ越し時の **2 回** 報告
- モジュールセッション: 60% / 引っ越し時の **2 回** 報告

### main の責務

- 各セッションからの報告を本ファイル §1 に追記
- main 引っ越し時に §2 期間別サマリ + §3 セッション別貢献度を更新
- 東海林さんへの報告（main 引っ越し時必須）= §5 履歴に追記

### 報告フォーマット（再掲）

```
| 項目 | 値 |
|---|---|
| Total commands | N |
| Input tokens | XX.XK |
| Output tokens | XX.XK |
| Tokens saved | XXX.XK (XX.X%) |
| Total exec time | XXXmXXs |
```
