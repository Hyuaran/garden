# 【a-auto 周知】to: a-tree

- 発信日時: 2026-04-25 01:00
- 発動シーン: 就寝前モード（a-auto 002、Batch 9 Tree Phase D spec 起草）
- a-auto 稼働時間: 2026-04-25 00:10 〜 01:00 頃

---

## a-auto が実施した作業（Tree Phase D spec 6 件起草）

コールセンター主力・FileMaker 代替の Tree Phase D 実装指示書 6 件を生成。M7-M8 で a-tree が自律実行可能な状態まで仕上げた。

| # | ファイル | 行 | 見積 | 優先度 |
|---|---|---|---|---|
| D-01 | schema-migration | 448 | 0.9d | 🔴 最高 |
| D-02 | operator-ui | 406 | 1.0d | 🔴 最高 |
| D-03 | manager-ui | 348 | 0.8d | 🔴 高 |
| D-04 | tossup-flow | 432 | 0.7d | 🔴 高 |
| D-05 | kpi-dashboard | 408 | 0.7d | 🟡 中 |
| D-06 | test-strategy | 502 | 1.0d | 🔴 最高 |

**合計 2,544 行 / 実装見積 5.1d**（テスト実装含む）

---

## 触った箇所

- ブランチ: `feature/tree-phase-d-specs-batch9-auto`（develop 派生、`8331585` 基点）
- 新規ファイル:
  - `docs/specs/tree/spec-tree-phase-d-01-schema-migration.md`
  - `docs/specs/tree/spec-tree-phase-d-02-operator-ui.md`
  - `docs/specs/tree/spec-tree-phase-d-03-manager-ui.md`
  - `docs/specs/tree/spec-tree-phase-d-04-tossup-flow.md`
  - `docs/specs/tree/spec-tree-phase-d-05-kpi-dashboard.md`
  - `docs/specs/tree/spec-tree-phase-d-06-test-strategy.md`
  - `docs/autonomous-report-202604250100-a-auto-tree.md`
- 既存ファイル編集: **なし**（spec 起草のみ、Tree 実装コードは一切触らない）
- コミット: 1 本、`[a-auto]` タグ付与
- push 状態: 完了
- PR: **#30 発行予定**（title: `docs(tree): Tree Phase D spec 6 件（Batch 9）`）

---

## あなた（a-tree）がやること（5 ステップ）

1. **`git pull origin develop`** で最新化（develop マージ前でも他ブランチ変化を把握）
2. **`docs/autonomous-report-202604250100-a-auto-tree.md` を読む**（個別レポート）
3. **`docs/broadcast-202604250100/to-a-tree.md`（このファイル）を読む**
4. **両方の内容を 1-2 行で要約**して東海林さんに返答
5. 判断保留 7 件を東海林さんに提示。合意できたら `docs/decisions/` に起草、できなければ「続きの作業を準備完了」で待機

---

## 判断保留事項（東海林さん向け、D-01 〜 D-06 各 §最終章の重要論点）

### 🔴 実装前に必須合意（優先 5 件）

| # | 論点 | a-auto 推定スタンス |
|---|---|---|
| 1 | 録音 Storage 設計 | Phase D-1 は PBX URL 格納のみ、Garden Storage 統合は D-1.5 検討 |
| 2 | オフラインキュー上限 | 500 件（超過で業務停止扱い） |
| 3 | 他商材対応時期（光 / クレカ） | 光回線 D-2 / クレカ D-3（商材重要度順） |
| 4 | FM vs Garden 統計照合自動化 | 自動化実装（Python + FM ODBC + Supabase） |
| 5 | 本番 rollback の実行権限 | 東海林さん + admin 2 人承認（二重承認） |

### 🟡 実装中に確認（各 spec §最終章）

| # | 論点 | spec |
|---|---|---|
| 6 | `result_code` の enum 化（CHECK vs 別テーブル）| D-01 判2 |
| 7 | Materialized View パーティショニング時期 | D-05 判5 |

他 30 件は優先度中〜低（実装着手時に確認で OK、a-tree 判断で解決可能）。

---

## 次に想定される作業（東海林さん向け）

### 短期（本 Batch 9 消化）
- 判断保留 5 件の合意取得
- `docs/decisions/tree-phase-d-decisions.md` 起草
- a-main 経由で Batch 9 PR #30 の develop マージ

### 中期（M7 前 = 2026-10 まで）
- Tree Phase D 実装開始準備
- §16 7 種テスト環境整備（Vitest / RTL+MSW / Playwright の Tree 🔴 専用設定）
- FM 並行運用計画書の作成（総務・マネージャー連携）

### 長期（M7-M9 = 2026-11 〜 2027-01）
- Phase D-01 〜 D-06 を順次実装（5.1d）
- §17 Tree 特例 5 段階展開（5-6 週間）
- FileMaker 切替の完遂

---

## Tree Phase D の独自ハイライト（他 Batch と異なる点）

### 1. 🔴 最厳格のテスト戦略（D-06）
Leaf 🟡 通常厳格度と比べ、Unit +15pp、E2E 本数 +5 本、境界値 100%。CI でカバレッジ未達の PR は **マージ禁止**（厳守ルール）。

### 2. FileMaker 互換性 = 必達条件
ショートカット F1-F10、結果ボタン配置、1 クリック進行、巻き戻し 5 秒窓 — すべて FM 時代と同等以上。**互換性欠如は α版で即 NO-GO**。

### 3. 5 段階展開の慎重さ
Tree 特例で α → 1 人 → 2-3 人 → 半数 → 全員 の **5 段階、累計 5-6 週間**。各段階に GO/NO-GO 判定基準あり、KPI ± 5% の差分で即 NO-GO。

### 4. オフライン耐性の必須化
コールセンター WiFi 断・モバイル回線利用を前提。localStorage キュー + flush 機構で業務継続性を保証。

### 5. マネージャー介入機能
リアルタイムダッシュボード（30s polling）+ 指示メッセージ送信（Chatwork）+ 自動アラート 5 種。Forest（全社 KPI）とは異なる日内粒度の運用ツール。

### 6. 案 D 準拠の情報統制
Chatwork 本文に **署名 URL を一切流さない**。Garden ログイン誘導のみ、機密情報の Garden 外流出を防止。

---

## 続きの作業準備完了の際の返答例

```
【a-tree 受信完了】
Tree Phase D spec 6 件（2,544 行 / 5.1d）を読み込みました。

要約: FileMaker 代替のコールセンター中核仕様。スキーマ 3 テーブル / オペレーター UI（FM 互換）/ マネージャー介入 / トスアップ / KPI / 🔴 最厳格テスト戦略。累計 Batch 9 で Phase A-D の骨格完成。

判断保留 5 件（最優先）を東海林さんに提示します:
1. 録音 Storage 設計
2. オフラインキュー上限
3. 他商材対応時期
4. FM 統計照合自動化
5. rollback 実行権限

回答待ちの間、続きの作業を準備完了で待機します。
```

---

— a-auto 002 → a-tree 周知 end —
