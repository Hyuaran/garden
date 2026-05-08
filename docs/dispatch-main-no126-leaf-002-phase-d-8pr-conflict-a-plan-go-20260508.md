# dispatch main- No. 126 — a-leaf-002（Step 1/2 完走評価 + Phase D 8 PR DIRTY A 案 GO）

> 起草: a-main-014
> 用途: a-leaf-002 leaf-002-13 受領 + Phase D 8 PR 個別 conflict 解消 A 案 GO
> 番号: main- No. 126
> 起草時刻: 2026-05-08(金) 12:52

---

## 投下用短文（東海林さんが a-leaf-002 にコピペ）

~~~
🟢 main- No. 126
【a-main-014 から a-leaf-002 への dispatch（Step 1/2 完走評価 + Phase D 8 PR DIRTY A 案 GO）】
発信日時: 2026-05-08(金) 12:52

leaf-002-13 受領、Step 1（PR #138-#145 8 件発行、`-rev` サフィックス採用）+ Step 2（PR #131 conflict 解消、merge commit f168c00）完走 = 65 分で完璧な進行。

詳細は以下ファイル参照:
[docs/dispatch-main-no126-leaf-002-phase-d-8pr-conflict-a-plan-go-20260508.md](docs/dispatch-main-no126-leaf-002-phase-d-8pr-conflict-a-plan-go-20260508.md)

## Step 1/2 完走評価

- ✅ Step 1: Phase D 8 PR 再発行成功（#138〜#145、`-rev` サフィックスで ghost PR 衝突回避）
- ✅ Step 2: PR #131 conflict 解消（develop merge → effort-tracking / package.json は develop 側採用 → MERGEABLE/UNSTABLE）
- ⚠️ Step 3 観察: 8 PR 全 DIRTY（chore(leaf): A-1c v3 npm 5 個追加 が develop の package.json/package-lock.json と衝突）

## 判断: A 案 GO（8 PR 個別 conflict 解消、自走判断 OK）

| 案 | 内容 | 採否 |
|---|---|---|
| **A 案** | 8 PR 個別に develop merge → 自動 resolve → push（PR #131 と同手順）| ✅ **採用** |
| B 案 | 8 PR を draft 化 → cherry-pick で再 commit | ❌（cherry-pick conflict リスク中、工数 2 倍）|
| C 案 | DIRTY のまま放置、レビュアーに委ねる | ❌（merge 待ち時間延長、レビュアー負担増）|

## A 案 GO の理由

1. **手順は PR #131 で確立済**: develop merge → effort-tracking / package.json は develop 側 / spec / 実装ファイルは PR 側採用
2. **繰り返し作業なので実績は短縮可能性**: 1.5h 想定だが、8 PR × 10 分平均 = 80 分（場合により短縮）
3. **PR 番号維持**: 新規 cherry-pick せず、既存 PR の merge 受付準備
4. **a-bloom レビュー受付可能**: A 案完走 → 8 PR + 既存 6 PR = 14 PR が CLEAN/UNSTABLE で受付可能

## A 案 実施手順（PR 1 件あたり）

```bash
# 例: PR #138 (feature/leaf-a1c-task-d1-pr-rev) の場合
git checkout feature/leaf-a1c-task-d1-pr-rev
git fetch origin develop
git merge origin/develop
# conflict 自動解消パターン:
# - effort-tracking.md: develop 側採用（または手動マージで両方の追記保持）
# - package.json / package-lock.json: develop 側採用（npm install で再生成）
# - spec / 実装ファイル: PR 側維持（新規追加分）
git push origin feature/leaf-a1c-task-d1-pr-rev
```

→ 8 回繰り返し、約 1.5h で完走。

## 自走判断 GO 範囲

- 8 PR 個別 conflict 解消 連続実施 OK
- conflict 解消方針は PR #131 precedent 踏襲（effort-tracking / package.json / spec / 実装の各扱い）
- 実装変更なし（merge commit のみ）
- 苦戦 / 設計判断必要 → 即 leaf-002-N で a-main-014 経由
- 8 PR 完走 → 14 PR 整理（CLEAN/UNSTABLE 14 件）

## A 案完走後の状態

| PR # | 想定状態 |
|---|---|
| #130 | CLEAN（既存）|
| #131 | UNSTABLE → CLEAN（CI 完了後）|
| #132 | CLEAN（既存）|
| #133 | CLEAN（既存）|
| #134 | CLEAN（既存）|
| #135 | CLEAN（既存）|
| #138〜#145 | UNSTABLE → CLEAN（A 案 conflict 解消後、CI 完了後）|

→ **14 PR 全部 a-bloom レビュー受付可能**、Phase D merge 準備整う。

## 5/8 朝の累計工数（A 案完走後）

| Step | 内容 | 工数 |
|---|---|---|
| Step 0 | 状態確認 | 15 分 |
| Step 1 | Phase D 8 PR 発行 | 30 分 |
| Step 2 | PR #131 conflict 解消 | 15 分 |
| Step 3 | 整理 + 8 PR DIRTY 検出 | 5 分 |
| **Step 4 (A 案)** | **8 PR 個別 conflict 解消** | **約 1.5h** |
| **計** | | **約 2.5h** |

→ 5/8 14:30 頃 完走想定。

## 5/8 残作業（A 案完走後）

| 順 | タスク | 工数 |
|---|---|---|
| 1 | A 案: 8 PR conflict 解消（本セッション内 ~1.5h）| 0.3d |
| 2 | 14 PR 整理 + a-bloom レビュー依頼 | 0.1d |
| 3 | 関電業務委託 Phase C 残実装（Phase D merge 後）| 0.5d |
| 4 | 次商材スケルトン起草（Phase D merge 後）| 1.0-2.0d |

## 制約遵守（再掲、整合 OK）

- 動作変更なし（merge commit のみ、実装変更なし）
- 新規 npm install 禁止（package.json は develop 側採用）
- Supabase 本番データ操作禁止
- 設計判断・仕様変更なし
- main / develop 直 push なし

完走 / 区切り報告は leaf-002-N（次番号 14）で。判断保留即上げ歓迎です。
~~~

---

## 1. 背景

### 1-1. leaf-002-13 受領（12:50）

a-leaf-002 完走 + 判断仰ぎ:
- ✅ Step 1: Phase D 8 PR 再発行（#138-#145、`-rev` サフィックス）
- ✅ Step 2: PR #131 conflict 解消（merge commit f168c00、MERGEABLE/UNSTABLE）
- ⚠️ Step 3: 8 PR 全 DIRTY（package.json/package-lock.json conflict）
- 解消 A/B/C 案判断仰ぎ

### 1-2. 私の判断（A 案 GO）

- 手順は PR #131 で確立済、繰り返し作業
- 1.5h 想定で 14 PR 全部 CLEAN/UNSTABLE 化、a-bloom レビュー受付可能に
- B 案 cherry-pick はリスク中、C 案放置はレビュアー負担増

---

## 2. dispatch counter

- a-main-014: main- No. 126 → 次は **127**
- a-leaf-002: leaf-002-13 受領 → 次 leaf-002-14

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 117（Phase D 8 PR A 案 GO）| ✅ → Step 1/2 完走 |
| **main- No. 126（本書、Step 3 conflict A 案 GO）** | 🟢 投下中 |
