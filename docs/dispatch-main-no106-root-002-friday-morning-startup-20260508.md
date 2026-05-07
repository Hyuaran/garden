# dispatch main- No. 106 — a-root-002（5/8 金曜朝 起動 + 認証統一 Task 1-6 spec 詳細化 GO）

> 起草: a-main-014（先行起草、5/8 朝投下用）
> 用途: a-root-002 5/8 金曜朝起動指示 + 認証統一 Task 1-6 spec 詳細化 + 5/10 集約役準備
> 番号: main- No. 106
> 起草時刻: 2026-05-07(木) 20:43

---

## 投下用短文（東海林さんが a-root-002 にコピペ、5/8 金曜朝に投下）

~~~
🟢 main- No. 106
【a-main-014 から a-root-002 への dispatch（5/8 金曜朝 起動 + 認証統一 Task 1-6 spec 詳細化 + 5/10 集約役準備）】
発信日時: 2026-05-08(金) 朝 投下用

おはようございます。5/7 木曜 plan 1429 行 + 集約役 5/10 計画ありがとうございました。1 日前倒しで 5/13-14 → 5/10 に前倒し合意済みです。

詳細は以下ファイル参照:
[docs/dispatch-main-no106-root-002-friday-morning-startup-20260508.md](docs/dispatch-main-no106-root-002-friday-morning-startup-20260508.md)

## 起動報告依頼

1. `git pull origin feature/root-bloom-progress-tables-phase-1a`
2. 状態報告:
   - plan 1429 行の最終確認状態
   - feature/garden-unified-auth-gate-20260509 ブランチ新設準備

## 5/8 金曜本日の優先タスク

### 第一優先: 認証統一 Task 1-6 spec 詳細化（想定 0.8d）

5/9 朝本格着手の前準備。各 Task の subagent-driven-development 形式で:
- Task 1: 統一 AuthGate コンポーネント設計
- Task 2: role 判定ロジック共通化
- Task 3: redirect 統一（/login → role 別 home）
- Task 4: 各モジュール側 redirect 受け入れ準備
- Task 5: middleware 統一
- Task 6: tests 整備

各 task の入出力 / 完了条件を明示化。

### 第二優先: 5/10 集約役準備（root_module_design_status migration、想定 0.5d）

7 モジュール .md（bloom / tree / leaf / root / soil / bud / forest）→ root_module_design_status migration に集約する schema + import script。

5/10 当日に bud.md（既完成）+ forest.md（5/9 朝完成予定）を一気に集約。

### 第三優先: /bloom/progress 表示内容反映 ロジック準備（想定 0.3d）

a-bloom-004 と連携、最新マイルストーン日付 / 12 モジュール網羅 / 全体進捗 % を反映する Server Action / RPC 設計。

## 自走判断 GO 範囲

- 認証統一 Task 1-6 spec 詳細化 連続実施 OK
- 5/10 集約役準備 連続実施 OK
- subagent-driven-development 形式で task 分解 OK
- 苦戦 / 設計判断必要 → 即 root-002-N で a-main-014 経由
- 認証統一は Bloom 独自認証独立性維持（Forest と独立、dev では BloomGate バイパス）

## 5/9 朝予定（リマインド）

- 認証統一 Task 1-6 本格着手（subagent-driven 並列）
- forest-9 完走報告 + forest.md design-status 受領
- a-bud bud.md は ✅ 既完成（5/7 19:38）

## 5/10 集約役（前倒し済）

- 7 モジュール .md → root_module_design_status migration
- /bloom/progress 最新反映（マイルストーン日付 / 全体進捗 % / 12 モジュール網羅）

## 制約遵守

- 動作変更なし（既存コードは触らない）
- 新規 npm install 禁止
- Supabase 本番データ操作禁止
- 設計判断・仕様変更なし
- main / develop 直 push なし
- 7 段階ロール権限マトリクス維持
- 認証統一は Bloom 独自認証独立性維持

完走 / 区切り報告は root-002-N（次番号 11）で。
~~~

---

## 1. 背景

5/8 金曜朝の a-root-002 起動指示。Thursday の plan 1429 行を受けて、認証統一 Task 1-6 spec 詳細化 + 5/10 集約役準備。

### 1-1. Thursday 夜の状態

plan 1429 行 + 集約役 5/10 計画。1 日前倒しで合意済み。

### 1-2. 5/8 金曜の本命

認証統一 Task 1-6 spec 詳細化（5/9 朝本格着手の前準備）+ 5/10 集約役準備。

---

## 2. dispatch counter

- a-main-014: main- No. 106 → 次は **107**

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| 直近: root-002-10（plan 1429 行 + 5/10 集約役）| ✅ 受領済 |
| **main- No. 106（本書、5/8 金曜朝 起動 + 認証統一 + 5/10 準備）** | 🔵 5/8 金曜朝 投下予定 |
