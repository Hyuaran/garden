# Tree Track B 判断保留 #3 確定反映 — handoff

- 日時: 2026-04-27 ~14:00 完了
- セッション: a-tree
- ブランチ: `feature/tree-track-b-supervisor-tools-20260427`（既存ブランチに追加 commit）
- 反映対象: a-main 判断回答（判断保留 #3 schema 依存方針）

## 確定事項

**判断保留 #3: F1+F3 schema 依存方針 = A 案「D-01 完成後 schema 流用」採択**

### 採択方針

| 項目 | 内容 |
|---|---|
| schema | Tree D-01 で作成される `tree_call_records` / `tree_calling_sessions` / `tree_agent_assignments` を流用 |
| 追加 migration | 不要（D-01 既存テーブルから集計クエリで F1 / F3 を構築） |
| 別 DB 連携 | 不要（Soil / FileMaker 経由なし、Garden 内完結） |
| 着手タイミング | D-01 完成 = Track A α 版開始 = Track B Phase 1 リリース可能 |

### 採択理由（a-main）
1. Track A α 版開始時に Track B 最小版リリース戦略と整合
2. 独自 schema は二重管理リスク高
3. FileMaker → Soil 経由は Soil Phase B 完成待ち = 早期展開意図と矛盾
4. D-01 完成 = Track A 最初のリリース可能段階、ここから Track B も活用可能

### 廃案

- 案 B（独自簡略 schema）: 二重管理 + 整合性別途担保で複雑化、却下
- 案 C（FileMaker → Soil 経由）: Soil Phase B 完成待ち、却下

## 反映内容

### spec 改訂（v1.0 → v1.1）

`docs/specs/tree/spec-tree-track-b-supervisor-tools.md`

| セクション | 変更内容 |
|---|---|
| ヘッダ | 改訂注記「v1.1（a-main 判断回答）— 判断保留 #3 = A 案採択」 |
| §6.1 | A 案採択方針 + 採択理由 4 点 + 廃案 B/C の理由 + 集計クエリ方針（`tree_call_records` 生 SELECT、件数増時に D-05 MV 流用） |
| §10 判断保留テーブル | #3 行を「✅ 確定（2026-04-27 a-main 判断）」マーク化 |
| §11.1 実装ロードマップ | ステップ 2「F1 最小版実装」の前提を「Tree D-01 schema 完成必須」に明記 |
| §13 リスク #2 | 「schema 不整合リスク」を「✅ 解消」化（A 案採択により構造的に発生しない） |
| 改訂履歴 | v1.1 行追加 |

## 残る判断保留

| # | 項目 | ステータス |
|---|---|---|
| 1 | F1 既存 Excel テンプレ提供 | **東海林さん判断保留**（業務知識依存、本人と直接やり取り想定） |
| 2 | F1 ファイル名命名規則 | **東海林さん判断保留** |
| 3 | F1+F3 schema 依存方針 | ✅ **確定（A 案採択）** |
| 4 | 優先順位最終確定 | **東海林さん判断保留**（推奨は F1+F3 セット） |
| 5 | F4 ヒアリング時期 | F1+F3 リリース 1 週間後（自動進行） |
| 6 | Phase 2 cron 配信時刻 | 業務既存ルール依存（実装着手時に確認） |
| 7 | F2 カテゴリ確定 | 業務実態と齟齬あれば調整（Phase 2 着手時） |

## 実装含意

- Track A の Phase D-01 schema migration（plan v3 §1 D-01 = 0.7d、12 タスク）が完成すれば、Track B Phase 1（F1+F3 最小版 = 1.5d）の実装着手条件が schema 面では満たされる
- 残る東海林さん判断（#1 #2 #4）が解消すれば即着手可能
- Track B Phase 1 リリース = Track A α 版開始タイミング（責任者経由で Garden 第一印象醸成）

## 干渉回避

- ✅ a-bud / a-auto / a-soil / a-root / a-leaf / a-forest 非接触
- ✅ Track A の慎重展開と独立進行
- ✅ Tree Phase D 既存 6 spec の本体は触らず（参照のみ）
- ✅ 実装コード変更なし（spec のみ）
- ✅ main / develop 直接 push 禁止

## 次のアクション

1. **GitHub 復旧後 push** + PR 更新（既存 `feature/tree-track-b-supervisor-tools-20260427` ブランチ）
2. **東海林さん確認**（残る判断保留 #1 #2 #4）
3. Tree D-01 schema 完成 → Track B Phase 1 実装着手準備完了
4. Track A α 版開始タイミングと連動した Track B Phase 1 リリース計画

---

## 改訂履歴

| 日付 | 版 | 改訂内容 | 担当 |
|---|---|---|---|
| 2026-04-27 | v1.0 | a-main 判断回答（判断保留 #3 = A 案採択）反映完了 | a-tree |
