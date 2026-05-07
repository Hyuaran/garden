# RTK 横断適用集計（main- No. 111 broadcast 応答集計）- 2026-05-07(木) 21:16

> 起草: a-main-014
> 用途: main- No. 111 RTK 横断 broadcast への各セッション応答を集計、最終サマリ起草
> 関連: [docs/dispatch-main-no111-rtk-cross-modules-broadcast-20260507.md](docs/dispatch-main-no111-rtk-cross-modules-broadcast-20260507.md)

---

## 1. 集計表（応答受領順、随時更新）

| # | セッション | 受領時刻 | 判定 | rtk version | 削減率（gain） | saved tokens | 備考 |
|---|---|---|---|---|---|---|---|
| 1 | a-soil | 2026-05-07 21:11 | ✅ 適用済 | 0.38.0 | **65.3%** | 486.8K | global scope、799 commands、Top 1: lint eslint 99.6% 削減 |
| 2 | a-bud | 待機中（5/8 朝に起動 + 確認予定）| — | — | — | — | bud-13 受領済（D-11 完走 + Thursday 夜切り上げ）|
| 3 | a-bloom-004 | 待機中（5/8 朝起動予定）| — | — | — | — | vitest 環境問題 5/8 朝調査と並行 |
| 4 | a-leaf-002 | 待機中（5/8 朝起動予定）| — | — | — | — | PR #130-#134 レビューと並行 |
| 5 | a-root-002 | 待機中（5/8 朝起動予定）| — | — | — | — | 認証統一 spec 詳細化と並行 |
| 6 | a-tree | 待機中（5/8 朝起動予定）| — | — | — | — | Phase D-02 続きと並行 |
| 7 | a-forest-002 | 待機中（#4 着手中、5/8 朝確認予定）| — | — | — | — | 継続中の場合は中断不要、5/8 朝に確認 |
| 8 | a-auto | 休眠中、次回発動時確認 | — | — | — | — | 自律実行モード発動時に確認 |
| 9 | a-rill / a-seed | 休眠中、次回起動時確認 | — | — | — | — | Phase B/C/D で起動予定 |
| 10 | b-main | 休眠中、次回起動時確認 | — | — | — | — | バックアップ用 |

---

## 2. 全体サマリ（応答揃った時点で更新）

### 現時点（2026-05-07 21:16、応答 1/7 active）

- 応答済: 1 セッション（a-soil）
- 待機中: 6 セッション（a-bud / a-bloom-004 / a-leaf-002 / a-root-002 / a-tree / a-forest-002）
- 平均削減率（暫定）: **65.3%**（n=1、a-soil のみ）
- 最高削減率: 65.3%（a-soil）
- 最低削減率: 65.3%（a-soil）

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

| 投下済（推定）| a-soil（応答受領済）|
| 投下中 / 投下予定 | a-bud / a-bloom-004 / a-leaf-002 / a-root-002 / a-tree / a-forest-002 |

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
