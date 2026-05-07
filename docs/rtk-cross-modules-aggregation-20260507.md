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
| 6 | a-bud | 待機中（5/8 朝に起動 + 確認予定）| — | — | — | — | bud-13 受領済（D-11 完走 + Thursday 夜切り上げ、9 件 / 329 tests / 62% 圧縮）|
| 7 | a-bloom-004 | 待機中（5/8 朝起動予定）| — | — | — | — | vitest 環境問題 5/8 朝調査と並行 |
| 8 | a-root-002 | 待機中（5/8 朝起動予定）| — | — | — | — | 認証統一 spec 詳細化と並行 |
| 9 | a-tree | 待機中（5/8 朝起動予定）| — | — | — | — | Phase D-02 続きと並行 |
| 10 | a-rill / a-seed | 休眠中、次回起動時確認 | — | — | — | — | Phase B/C/D で起動予定 |
| 11 | b-main | 休眠中、次回起動時確認 | — | — | — | — | バックアップ用 |

---

## 2. 全体サマリ（応答揃った時点で更新）

### 現時点（2026-05-07 22:00、応答 5/9 active）

- 応答済: **5 セッション**（a-soil / a-forest-002 / a-leaf-002 / a-review / a-auto-004）
- 待機中（active）: 4 セッション（a-bud / a-bloom-004 / a-root-002 / a-tree）
- 休眠中: a-rill / a-seed / b-main
- 平均削減率: **65.2%**（65.3% × 3 + 65.1% × 2 = 326/5）

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

| 投下済（応答受領）| a-soil / a-forest-002 / a-leaf-002 / a-review / a-auto-004 |
| 投下中 / 投下予定 | a-bud / a-bloom-004 / a-root-002 / a-tree |

## 5.1 セッション別 体感コメント（質的観察）

| セッション | 体感 |
|---|---|
| a-soil | Phase B-01 第 1 弾 7 migrations / 3 TS / 46 tests を約 13 倍速で完走、RTK が `rtk read` `rtk grep` `rtk git commit` で効いた |
| a-forest-002 | Phase B-min #4 弥生 CSV パーサー着手中、`rtk vitest run` 99.7% 削減が TDD ループに効く |
| a-leaf-002 | 本日 6 PR 発行（git commit/push/fetch/branch 多用）= **61% 短縮の主要因実感**、`rtk lint eslint` 99.6% が Phase A UI 実装で更に伸びる見込み |
| a-review | PR レビュー（git diff / read / grep / lint）の頻出コマンドが上位独占、**RTK 恩恵 特大**セッション |
| a-auto-004 | Phase 残 A 50+ PR 操作 + spec 修正 + self-review で hot path 効果最大化、ガンガン常態モード継続可能状態 |

---

## 6. 集計完了後のアクション

全セッション応答揃ったら:

1. 本ファイルの集計表を最終化
2. 平均削減率 / 最高 / 最低 / 中央値を算出
3. main- No. NNN として「RTK 全セッション集計サマリ」dispatch 起草（任意）
4. CLAUDE.md §19 改訂候補（実測値で目標値を 60% → 65% に更新）東海林さんに提案

---

## 7. 関連 docs

- [docs/dispatch-main-no111-rtk-cross-modules-broadcast-20260507.md](docs/dispatch-main-no111-rtk-cross-modules-broadcast-20260507.md)
- CLAUDE.md §19 トークン削減ルール
- ユーザー global RTK.md（C:/Users/shoji/.claude/RTK.md）
- handoff-a-main-013-to-014-20260507.md（RTK 64.9% 削減記載）
