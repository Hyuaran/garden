# dispatch main- No. 123 — a-root-002（中間進捗受領 + PR 4 件不整合 a-tree/a-leaf precedent 共有）

> 起草: a-main-014
> 用途: a-root-002 root-002-12.5 中間報告受領 + PR 4 件 GitHub 不整合への workaround precedent 共有
> 番号: main- No. 123
> 起草時刻: 2026-05-08(金) 12:45

---

## 投下用短文（東海林さんが a-root-002 にコピペ）

~~~
🟢 main- No. 123
【a-main-014 から a-root-002 への dispatch（中間進捗受領 + PR 4 件不整合 a-tree/a-leaf precedent 共有）】
発信日時: 2026-05-08(金) 12:45

root-002-12.5 受領、PR #136 / #137 発行成功 + plan 補強 +191 行 ありがとうございます。

詳細は以下ファイル参照:
[docs/dispatch-main-no123-root-002-mid-status-pr-precedent-share-20260508.md](docs/dispatch-main-no123-root-002-mid-status-pr-precedent-share-20260508.md)

## 中間進捗 評価

- ✅ PR 6 件試行 → 2 件成功（#136 dispatch v3 / #137 Bloom 進捗 Phase 1a）
- ⚠️ 4 件 GitHub 不整合（already exists エラー、list 未表示）
- ✅ plan 補強完了（subagent prompts +191 行、Task 1-6 / Phase B Task 7-9 / Task 10 drafts）

## ⚠️ 4 件 PR 不整合 = a-tree / a-leaf-002 と同じ Hyuaran org 移管時の取り残し問題

### 既知 precedent（同問題、a-leaf-002 と同根）

a-tree: PR #109/#110 消失 → branch を `-reissue-20260507` 命名でリネーム push → 新規 PR 発行成功（PR #128/#129、5/7 18:55 完了）。

a-leaf-002: 5/7 朝に Phase D 8 PR 未発行発見（main- No. 117 で本日 A 案 GO、再発行作業中）。

**根本原因（推定）**:
- Hyuaran org 移管前の旧 repo（ShojiMikoto-A account fork）に PR が登録されていた
- branch は引き継がれたが、PR は引き継がれず、移管後に「already exists」エラー（GitHub 内部に痕跡残存）

### 解消方法（a-tree A 案 precedent、推奨）

| Step | 作業 |
|---|---|
| 1 | 残 4 ブランチを `<元の名前>-reissue-20260508` で新規 push（同一 commit 履歴）|
| 2 | 新ブランチで PR 発行（develop 宛）|
| 3 | PR title / body は元の意図を踏まえて起草 |

例:
```
git checkout feature/root-phase-b-specs-20260425
git checkout -b feature/root-phase-b-specs-reissue-20260508
git push -u origin feature/root-phase-b-specs-reissue-20260508
gh pr create --base develop --title "..." --body "..."
```

→ コード差分なし、commit 完全一致。

### 5/8 完走報告までの対応

完走報告（17:30）までに残 4 件の reissue 発行可能なら GO、時間切れなら 5/9 朝対応 OK:

- 5/8 中対応: 残 4 件 reissue PR 発行（推定 30 分、a-tree 5 分/件 precedent）
- 5/9 朝: 認証統一 Task 1-6 着手前に reissue 発行
- 後追い: 5/10 集約役 + /bloom/progress 反映 と並行

東海林さんスタンス（ガンガン）に整合する判断、自走判断 OK。

## 5/8 残タスク 認識整合

| 時間 | タスク | 状態 |
|---|---|---|
| 13:00-15:30 | Phase B-1 実装プラン起草（writing-plans skill）| 🔵 着手予定 |
| 15:30-17:00 | 5/10 集約役準備（root_module_design_status migration plan）| 🔵 着手予定 |
| 17:00-17:30 | /bloom/progress 反映ロジック準備 + 完走報告 | 🔵 着手予定 |

→ 妥当、ガンガン継続。

## Q1 / Q2 確定認識整合

- Q1: middleware 統一 = Phase B（Task 7-9）後追い OK ✅
- Q2: a-root-002 plan の Task 1-6 で 5/9 朝 GO ✅
- plan 末尾 subagent prompts は本回答に基づき Task 1-6 構造でドラフト済 ✅

## 自走判断 GO 範囲

- 残 4 件 PR reissue 発行 自走 OK（a-tree precedent 踏襲）
- Phase B-1 実装プラン起草 連続着手 OK
- 5/10 集約役準備 連続着手 OK
- 苦戦 / 設計判断必要 → 即 root-002-N で a-main-014 経由

## 制約遵守（再掲、整合 OK）

- 動作変更なし
- 新規 npm install 禁止
- Supabase 本番データ操作禁止
- main / develop 直 push なし
- 7 段階 → 8 段階ロール（Phase A-3-g 反映済）
- Bloom 独自認証独立性維持

完走 / 区切り報告は root-002-N（次番号 13）で。判断保留即上げ歓迎です。
~~~

---

## 1. 背景

### 1-1. root-002-12.5 受領（10:35）

a-root-002 中間報告:
- ✅ PR 2 件成功（#136 dispatch v3 / #137 Bloom 進捗 Phase 1a）
- ⚠️ 4 件 PR 不整合（GitHub「already exists」error、list 未表示）
- ✅ plan 補強完了（subagent prompts +191 行）

### 1-2. 私の判断（a-tree precedent 共有）

- 同問題が a-tree（PR #109/#110）+ a-leaf-002（Phase D 8 PR）で発生
- a-tree A 案（reissue ブランチ命名）が precedent として有効
- 残 4 件 PR 発行は自走判断 OK（5/8 中 or 5/9 朝）

---

## 2. dispatch counter

- a-main-014: main- No. 123 → 次は **124**
- a-root-002: root-002-12.5（中間）→ 次完走 root-002-13

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 90（a-tree A 案 PR reissue 承認）| ✅ 5/7 PR #128/#129 reissue 発行 |
| main- No. 117（a-leaf-002 Phase D 8 PR A 案 GO）| ✅ 5/8 進行中 |
| main- No. 115（a-root-002 Q1/Q2 回答）| ✅ 投下済 |
| **main- No. 123（本書、PR precedent 共有）** | 🟢 投下中 |
