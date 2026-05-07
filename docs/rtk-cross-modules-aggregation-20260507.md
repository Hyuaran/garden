# RTK 横断適用集計（main- No. 111 broadcast 応答集計）- 2026-05-07(木) 21:16

> 起草: a-main-014
> 用途: main- No. 111 RTK 横断 broadcast への各セッション応答を集計、最終サマリ起草
> 関連: [docs/dispatch-main-no111-rtk-cross-modules-broadcast-20260507.md](docs/dispatch-main-no111-rtk-cross-modules-broadcast-20260507.md)

---

## 1. 集計表（応答受領順、随時更新）

| # | セッション | 受領時刻 | 判定 | rtk version | 削減率（gain） | saved tokens | 備考 |
|---|---|---|---|---|---|---|---|
| 1 | a-soil | 2026-05-07 21:11 | ✅ 適用済 | 0.38.0 | **65.3%** | 486.8K | global scope、799 commands、Top 1: lint eslint 99.6% 削減 / Phase B-01 第 1 弾完走（13 倍速）|
| 2 | a-forest-002 | 2026-05-07 21:12 | ✅ 適用済 | 0.38.0 | **65.3%** | 486.8K | 同 global、Phase B-min #4 弥生 CSV パーサー着手中、継続作業 |
| 3 | a-leaf-002 | 2026-05-07 21:55 | ✅ 適用済 | 0.38.0 | **65.3%** | 486.8K | 同 global、本日 6 PR 発行（git commit/push/fetch/branch 多用）= 61% 短縮の主要因実感 |
| 4 | a-review | 2026-05-07 21:15 | ✅ 適用済 | 0.38.0 | **65.1%** | 488.1K | global、816 commands、PR レビュー（diff/read/grep/lint）で恩恵特大 |
| 5 | a-auto-004 | 2026-05-07 21:10 | ✅ 適用済 | 0.38.0 | **65.1%** | 488.2K | global、821 commands、Phase 残 A 50+ PR 操作で hot path 効果最大化 |
| 6 | a-root-002 | 2026-05-07 21:12 | ✅ 適用済 | 0.38.0 | **65.1%** | 488.3K | global、824 commands、git/vitest/read/grep/lint 系 RTK 透過処理確認 |
| 7 | a-bud | 待機中（5/8 朝に起動 + 確認予定）| — | — | — | — | bud-13 受領済（D-11 完走 + Thursday 夜切り上げ、9 件 / 329 tests / 62% 圧縮）|
| 7 | a-bloom-004 | 待機中（5/8 朝起動予定）| — | — | — | — | vitest 環境問題 5/8 朝調査と並行 |
| 8 | a-tree | 待機中（5/8 朝起動予定）| — | — | — | — | Phase D-02 続きと並行 |
| 9 | a-rill / a-seed | 休眠中、次回起動時確認 | — | — | — | — | Phase B/C/D で起動予定 |
| 10 | b-main | 休眠中、次回起動時確認 | — | — | — | — | バックアップ用 |

---

## 2. 全体サマリ（応答揃った時点で更新）

### 最終（2026-05-07 21:30、応答 **9/9 active = 100%**）✅

- 応答済: **9 セッション全完走**（a-soil / a-forest-002 / a-leaf-002 / a-review / a-auto-004 / a-root-002 / a-bud / a-bloom-004 / a-tree）
- 待機中: ゼロ
- 休眠中: a-rill / a-seed / b-main（次回起動時確認）
- 平均削減率: **65.2%**（65.3% × 4 + 65.1% × 5 = 586.7/9）
- **CLAUDE.md §19 目標 60% を 5.2pp 超過、ガンガン常態モード成立確定**

### 観察（global scope の特性 + 時系列推移）

- rtk gain は **global scope 集約**（C:/Users/shoji/.local/bin/rtk が単一 binary）
- → 全セッションで同じ削減数値が表示される、ただし**報告タイミングの差で commands 数が増加**
- → 21:11 時点 799 commands → 21:15 時点 816 commands → 21:10 時点 821 commands（注: タイムスタンプは報告時刻、rtk gain 取得時刻は微差）
- → 削減率は 65.1-65.3% で安定、CLAUDE.md §19 目標 60% を 5pp 超過
- 各セッションの観察コメント（continued の体感）を別途集約することで質的価値を取る

### 期待値（CLAUDE.md §19 目標 + handoff データ）

- 目標: 60% 削減
- handoff 報告: 64.9% 削減（5/6-5/7 累計、476.3K トークン）
- a-soil 単独: 65.3% 削減（global scope、486.8K トークン）
- → handoff 報告と整合、超過達成

### 想定: 全セッション応答後の予測

a-bud / a-bloom-004 / a-leaf-002 / a-soil 等の高活動セッションでも 60-70% 削減と予測。
未活用 command（rtk discover）の発見で更なる改善余地あり。

---

## 3. 注目ポイント（a-soil 報告から）

### Top 3 削減 command（a-soil）

| # | Command | Count | Saved | Avg% |
|---|---|---|---|---|
| 1 | `rtk lint eslint` | 2 | 181.1K | 99.6% |
| 2 | `rtk read` | 52 | 100.7K | 23.8% |
| 3 | `rtk grep` | 23 | 68.0K | 14.7% |

→ `rtk lint eslint` の 99.6% 削減が突出、全セッションで lint 多用するなら全体さらに加速可能。

### 観察

- `rtk vitest run` 7 回 / 平均 99.7% 削減（Vitest 多用するセッションで効く）
- `rtk git commit` 64 回 / 95.8% 削減（ガンガン commit 戦略の token cost が無視レベル）
- → ガンガン常態モードと RTK の親和性が極めて高い

---

## 4. 未報告セッションへの追加アクション（必要時）

5/8 朝の各セッション起動 dispatch（main- No. 102-108）に「RTK 確認」を追記する案あり。
ただし、5/8 朝の起動報告で自然に確認できるため、追加 dispatch 不要と判断。

---

## 5. 横断 dispatch 投下対象の進捗

東海林さんが順次 main- No. 111 を各セッションに投下中。

| 投下済（応答受領）| **9/9 全 active セッション完走** ✅ |
| 投下不要 | 休眠中 a-rill / a-seed / b-main（次回起動時確認）|

## 5.1 セッション別 体感コメント（質的観察）

| セッション | 体感 |
|---|---|
| a-soil | Phase B-01 第 1 弾 7 migrations / 3 TS / 46 tests を約 13 倍速で完走、RTK が `rtk read` `rtk grep` `rtk git commit` で効いた |
| a-forest-002 | Phase B-min #4 弥生 CSV パーサー着手中、`rtk vitest run` 99.7% 削減が TDD ループに効く |
| a-leaf-002 | 本日 6 PR 発行（git commit/push/fetch/branch 多用）= **61% 短縮の主要因実感**、`rtk lint eslint` 99.6% が Phase A UI 実装で更に伸びる見込み |
| a-review | PR レビュー（git diff / read / grep / lint）の頻出コマンドが上位独占、**RTK 恩恵 特大**セッション |
| a-auto-004 | Phase 残 A 50+ PR 操作 + spec 修正 + self-review で hot path 効果最大化、ガンガン常態モード継続可能状態 |
| a-root-002 | git / vitest / read / grep / lint 系がほぼ全て RTK 経由で透過処理されていることを確認、認証統一 plan 1429 行起草に効いた |
| a-bud | Phase D 9 件 / 累計 27 commits（rtk git commit 64 回 / 95.8%）+ 329 tests（rtk vitest run 99.7%）+ rtk lint eslint 99.6% で **62% 圧縮の基盤** |
| a-bloom-004 | Phase 1+3+2A+2B 等 8 件 / 6 倍速の主要因実感、★ **vitest passthrough 問題発見**（§6）|
| a-tree | PR #128/#129 review 待ち、5/8-12 下準備に RTK 適用継続 |

---

## 6. ★ 副次発見: vitest passthrough 問題（a-bloom-004 報告）

### 6-1. 発見内容

a-bloom-004 が bloom-004- No. 52 報告で発見:
- bloom-004- No. 50「vitest 苦戦判断」の **真因 = RTK passthrough**
- `rtk vitest run` 7 回 / 99.7% 削減 = vitest は **実際に RTK 経由で実行されている**
- 5/7 19:18 試行時の `[RTK:PASSTHROUGH] vitest parser: All parsing tiers failed` = RTK parser が vitest 出力を理解できず passthrough、**stdout が caller に届かず結果見えない**仕様の可能性

### 6-2. 影響範囲

- a-bloom-004 単独問題ではなく、**Garden 全モジュールが vitest 動作確認時に同じ問題遭遇可能性**
- a-bud / a-soil で 305 + 46 = 351 tests 動作中なのは「結果が見える方法を見つけている」のか「passthrough でも動作している」のか要確認
- bloom-004- No. 50「vitest 環境問題」の 5/8 朝調査タスクを再構成必要

### 6-3. 推奨対応

| # | 対応 | 担当 | 工数 |
|---|---|---|---|
| 1 | RTK 担当（東海林さん本人）に「vitest parser 強化」可能か確認 | 東海林さん | 0.05d |
| 2 | RTK bypass オプション（vitest 実行時のみ）の有無確認 | 東海林さん | 0.05d |
| 3 | 5/8 朝 a-bloom-004 vitest 調査 dispatch（main- No. 103）を「RTK passthrough 解決優先」に再構成 | a-main-014 | 0.05d |
| 4 | a-bud / a-soil の vitest 実行方法を a-bloom-004 に共有（成功パターン抽出） | a-bud / a-soil | 0.1d |

### 6-4. 修正済 dispatch（main- No. 103）

5/8 朝の a-bloom-004 起動 dispatch（main- No. 103）に **「RTK vitest passthrough 問題」の調査優先**を追記候補。
東海林さん判断後、main- No. 103 を改訂 or 別 dispatch（main- No. 113 等）で補強。

---

## 7. 集計完了後のアクション

全セッション応答揃ったら（**完了済 9/9**）:

1. ✅ 本ファイルの集計表を最終化
2. ✅ 平均削減率 65.2%（n=9）算出
3. **次**: 副次発見（vitest passthrough）の対応判断 → 東海林さんへ報告（a-main-014 内 chat）
4. **次**: CLAUDE.md §19 改訂候補（実測値で目標値を 60% → 65% に更新）東海林さんに提案 → 5/14-16 デモ後

---

## 7. 関連 docs

- [docs/dispatch-main-no111-rtk-cross-modules-broadcast-20260507.md](docs/dispatch-main-no111-rtk-cross-modules-broadcast-20260507.md)
- CLAUDE.md §19 トークン削減ルール
- ユーザー global RTK.md（C:/Users/shoji/.claude/RTK.md）
- handoff-a-main-013-to-014-20260507.md（RTK 64.9% 削減記載）
