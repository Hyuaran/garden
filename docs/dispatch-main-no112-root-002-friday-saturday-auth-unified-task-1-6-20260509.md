# dispatch main- No. 112 — a-root-002（5/9 朝 認証統一 Task 1-6 本格着手 GO + subagent-driven 並列）

> 起草: a-main-014（先行起草、5/9 朝投下用）
> 用途: a-root-002 5/9 朝の認証統一 Task 1-6 本格着手指示、5/8 朝 spec 詳細化（main- No. 106）との連続性
> 番号: main- No. 112
> 起草時刻: 2026-05-07(木) 21:30

---

## 投下用短文（東海林さんが a-root-002 にコピペ、5/9 朝に投下）

~~~
🟢 main- No. 112
【a-main-014 から a-root-002 への dispatch（5/9 朝 認証統一 Task 1-6 本格着手 + subagent-driven 並列 GO）】
発信日時: 2026-05-09(土) 朝 投下用

おはようございます。5/8 spec 詳細化 完成ありがとうございました（main- No. 106）。
本日 5/9（土）から認証統一 Task 1-6 本格着手 GO です。

詳細は以下ファイル参照:
[docs/dispatch-main-no112-root-002-friday-saturday-auth-unified-task-1-6-20260509.md](docs/dispatch-main-no112-root-002-friday-saturday-auth-unified-task-1-6-20260509.md)

## 本日のミッション（5/9 土曜）

### Phase A 認証統一 Task 1-6 本格着手（subagent-driven 並列、想定 1.0d）

5/8 spec 詳細化完成 → 本日 subagent-driven-development 形式で並列実装。

### ブランチ新設

```
git checkout -b feature/garden-unified-auth-gate-20260509
```

`feature/root-bloom-progress-tables-phase-1a` から派生 OK、または develop ベースで新設。

## Task 1-6 本格着手 GO

| Task | 内容 | subagent | 想定 |
|---|---|---|---|
| Task 1 | 統一 AuthGate コンポーネント実装 | 1 | 0.2d |
| Task 2 | role 判定ロジック共通化（lib/auth/role-resolver.ts）| 1 | 0.15d |
| Task 3 | redirect 統一（/login → role 別 home：CEO/admin → /、manager → /root、staff → /tree）| 1 | 0.15d |
| Task 4 | middleware 統一（middleware.ts、全モジュール共通）| 1 | 0.2d |
| Task 5 | 各モジュール側 redirect 受け入れ準備（Bloom 除く）| 1 | 0.2d |
| Task 6 | tests 整備（単体 + 結合）| 1 | 0.1d |

## 自走判断 GO 範囲

- Task 1-6 連続着手 OK（subagent-driven で並列 task 分割推奨）
- 既存 plan 1429 行を spec として完全準拠
- 苦戦 / 設計判断必要 → 即 root-002-N で a-main-014 経由
- **Bloom 独立認証独立性維持**（dev では BloomGate バイパス、本番は Bloom 独自ロック解除）
- TDD 厳守、tests 単体 + 結合で 50+ tests 想定

## 5/10 集約役 前準備（並行）

5/9 中に下記を確認:

- [ ] 7 モジュール .md（bloom / tree / leaf / root / soil / bud / forest）の最新状態
- [ ] forest.md は 5/9 朝完成見込み（a-forest-002 forest-N 完走報告で確認）
- [ ] root_module_design_status migration の schema 確定
- [ ] import script の dry-run

5/10 集約役本番では:
- 7 モジュール .md → root_module_design_status migration の一括 import
- /bloom/progress 表示反映（マイルストーン日付 / 全体進捗 % / 12 モジュール網羅）

## 5/11-12 redirect 統一 Phase B 接続

5/9 Task 1-6 完成 → 5/11-12 で各モジュール側の redirect 統一 Phase B:
- a-bud / a-soil / a-leaf-002 / a-tree / a-forest-002 の redirect 受け入れ
- 各モジュールセッションへ dispatch 投下（横断 broadcast）
- 5/13 統合テストで 12 モジュール × 認証統一 全動作確認

## 制約遵守

- 動作変更なし（既存コードは触らない、Task 1-6 は新規実装）
- 新規 npm install 禁止
- Supabase 本番（garden-prod）データ操作禁止
- 設計判断・仕様変更なし
- main / develop 直 push なし
- 7 段階ロール権限マトリクス維持
- Bloom 独立認証独立性維持

## 5/9 完走目標

- Task 1-6 完成（50+ tests green）
- feature/garden-unified-auth-gate-20260509 PR 発行
- 5/10 集約役の前準備完了
- 完走報告: root-002-N（次番号、推奨 12）

ガンガンモード継続、本格着手 GO です。判断保留即上げ歓迎です。
~~~

---

## 1. 背景

### 1-1. 5/8 spec 詳細化 完成（5/8 main- No. 106 投下後）

a-root-002 が 5/8 朝起動 + 認証統一 Task 1-6 spec 詳細化 完成（想定）。
- Task 1: 統一 AuthGate コンポーネント設計
- Task 2: role 判定ロジック共通化
- Task 3: redirect 統一
- Task 4: middleware 統一
- Task 5: 各モジュール側 redirect 受け入れ準備
- Task 6: tests 整備

### 1-2. 5/9 本格着手の意義

5/13 統合テスト + 5/14-16 デモ前提として、5/9-12 で認証統一実装 + redirect 統一を完成必須。
5/9 = Task 1-6 本格着手 → 5/11-12 = redirect 統一 Phase B → 5/13 統合テスト → 5/14-16 デモ。

---

## 2. subagent-driven-development の活用

a-root-002 内で subagent-driven-development（superpowers）を活用:
- Task 1-6 を 6 つの subagent task として並列 dispatch
- 各 subagent が単一 task に集中、a-root-002 主体は orchestration
- 並列実行で 1.0d → 0.5d 圧縮可能性あり

---

## 3. dispatch counter

- a-main-014: main- No. 112 → 次は **113**

---

## 4. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 106（5/8 朝 起動 + spec 詳細化）| 🔵 5/8 朝 投下予定 |
| **main- No. 112（本書、5/9 朝 Task 1-6 本格着手 GO）** | 🔵 5/9 朝 投下予定 |
| 5/10 集約役 dispatch（main- No. 113 予定）| 🔵 別途起草予定 |

---

## 5. 5/9-13 a-root-002 タイムライン

| 日 | タスク |
|---|---|
| 5/8（金）| spec 詳細化 + 5/10 集約役準備 |
| **5/9（土）** | **Task 1-6 本格着手 + 5/10 前準備** |
| 5/10（日）| 集約役 + /bloom/progress 反映 |
| 5/11-12 | redirect 統一 Phase B（各モジュール横断 broadcast）|
| 5/13 | 統合テスト + Vercel デプロイ |
| 5/14-16 | 後道さんデモ |
