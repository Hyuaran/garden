# a-bloom-002 dispatch - v2.8a 第 3 弾 + ForestGate 判断確定（A 案 / A-2 案） - 2026-04-28

> 起草: a-main-010
> 用途: a-bloom-002 への判断確定 dispatch（dark 第 3 弾 A 案 + ForestGate A-2 案）
> 前提: a-bloom-002 犯人特定報告 + ForestGate 差分分析報告（4/28）
> 東海林さん承認: 「推奨で進める」（4/28）

---

## 結論サマリ

| # | 判断項目 | 採択 |
|---|---|---|
| 1 | dark 透明度の修正方法 | **A 案**: `.garden-v28a-main` から `z-index: 1` 削除 + alpha を `0.55-0.7` に revert |
| 2 | ForestGate.tsx 差分の処理 | **A-2 案**: 一旦 stash 退避 → dark 完走後に別ブランチで commit |

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
【a-main-010 から a-bloom-002 へ判断確定 dispatch】

東海林さん承認いただきました。両件とも推奨案で進めてください。

判断 1（dark 第 3 弾）: A 案
判断 2（ForestGate）: A-2 案

詳細手順は a-main-010/docs/bloom-002-dispatch-v2-8a-decisions-a-and-a2-20260428.md にあります。

【実行順序（重要）】

Step 0: ForestGate.tsx を stash 退避（最初に）
  cd /c/garden/a-bloom-002
  git stash push -u -m "forestgate-login-unification-wip-20260428" -- src/app/forest/_components/ForestGate.tsx
  git status  # clean になるはず

Step 1: dark 第 3 弾 A 案実装
  - src/app/globals.css line 928-933 の .garden-v28a-main から z-index: 1; を削除
    （position: relative; は残す）
  - alpha を DESIGN_SPEC §1-2 同値（0.55 / 0.6 / 0.7）に revert
    既存 commit 333ecef (0.94) / d080e45 (0.82) で上げた値を元に戻す

Step 2: localhost:3000 で東海林さん再確認
  - dark mode に切替
  - Activity Panel / KPI cards / Orb cards のぼかしが効いているか視覚確認
  - DevTools Computed で backdrop-filter: blur(16px) になっているか確認（補強）

Step 3: 東海林さん OK 出たら commit + push
  - commit message: fix(home): v2.8a 第 3 弾 - .garden-v28a-main z-index 削除で backdrop-filter 復活 + alpha revert [dispatch v2.8a 第 3 弾]
  - push: feature/garden-common-ui-and-shoji-status

Step 4: dark 完走後、ForestGate を別ブランチで commit（A-2 後半）
  - git checkout -b feature/garden-login-unification-forestgate（develop ベースで）
  - git stash pop
  - git add src/app/forest/_components/ForestGate.tsx
  - git commit -m "refactor(forest): ForestGate を Garden 統一 login UI に整理（v7-B login改修 残置分）"
  - git push -u origin feature/garden-login-unification-forestgate
  - PR 作成は東海林さん承認後（先に diff 共有して判断仰ぐ）

【重要な補足】

- ForestGate.tsx は「login UI を持つ唯一の Gate ファイル」（他 Gate は /{module}/login へリダイレクトする薄いラッパー）
  → 統一改修としては ForestGate 単独で完結するが、forest/login/page.tsx, root/login/page.tsx, tree/login/page.tsx の login ページ側の統一状況も別途確認推奨（次工程候補）
- もし Step 1 実装中に「z-index: 1 削除では足りない」「globals.css 上の他要素も SC 形成している」等が判明したら、即停止して a-main-010 に報告
- alpha 値は prototype 仕様（DESIGN_SPEC §1-2）と byte-for-byte 一致が原則、推測で値を変えない

【完了報告 期待フォーマット】

a-main-010 に以下の項目で報告：
1. ForestGate stash 結果（success/失敗）
2. dark A 案実装内容（git diff）
3. localhost:3000 視覚確認結果（東海林さん OK/NG）
4. commit hash + push 状態
5. ForestGate 別ブランチ commit hash + push 状態
6. PR 作成判断材料（diff 共有）
~~~

---

## 詳細手順（参考、a-bloom-002 が必要時に参照）

### Step 0: ForestGate.tsx stash 退避

```bash
cd /c/garden/a-bloom-002
git stash push -u -m "forestgate-login-unification-wip-20260428" -- src/app/forest/_components/ForestGate.tsx
git status
```

→ `nothing to commit, working tree clean` になることを確認。

### Step 1: dark 第 3 弾 A 案実装

#### 1-1. `.garden-v28a-main` の `z-index: 1` 削除

`src/app/globals.css` 928-933 行目周辺：

修正前：
```css
.garden-v28a-main {
  margin-left: var(--sidebar-w);
  padding: calc(var(--topbar-h) + 24px) 32px 32px;
  position: relative;
  z-index: 1;          /* ← 削除 */
}
```

修正後：
```css
.garden-v28a-main {
  margin-left: var(--sidebar-w);
  padding: calc(var(--topbar-h) + 24px) 32px 32px;
  position: relative;
}
```

#### 1-2. alpha を DESIGN_SPEC 同値に revert

既存 commit `d080e45` / `333ecef` で `--bg-card` / `--bg-overlay` 等の alpha を 0.82 / 0.94 まで上げた変更を、prototype 仕様の `0.55 / 0.6 / 0.7`（DESIGN_SPEC §1-2 確認必須）に戻す。

→ 具体的な値は a-bloom-002 が DESIGN_SPEC §1-2 を読んで確定（推測しない）。

### Step 2: localhost:3000 で東海林さん再確認

- localhost:3000 を Chrome で開いてダーク切替
- Activity Panel / KPI cards / Orb cards のぼかしが効いているか視覚確認
- DevTools 補強：Computed タブで `backdrop-filter` が `blur(16px)` になっているか（祖先 SC 解消の証拠）

### Step 3: dark commit + push

```bash
git add src/app/globals.css
git commit -m "fix(home): v2.8a 第 3 弾 - .garden-v28a-main z-index 削除で backdrop-filter 復活 + alpha revert [dispatch v2.8a 第 3 弾]"
git push origin feature/garden-common-ui-and-shoji-status
```

### Step 4: ForestGate 別ブランチ commit（dark 完走後）

```bash
# develop 最新化
git fetch origin develop
git checkout -b feature/garden-login-unification-forestgate origin/develop

# stash 復元
git stash pop

# 確認
git diff src/app/forest/_components/ForestGate.tsx

# commit + push
git add src/app/forest/_components/ForestGate.tsx
git commit -m "refactor(forest): ForestGate を Garden 統一 login UI に整理（v7-B login改修 残置分）"
git push -u origin feature/garden-login-unification-forestgate

# 元のブランチに戻る
git checkout feature/garden-common-ui-and-shoji-status
```

PR 作成は a-main-010 経由で東海林さん承認後。先に diff 共有。

---

## a-bloom-002 への進行 Step 表

| Step | 内容 | 担当 | 成果物 |
|---|---|---|---|
| 0 | ForestGate.tsx stash 退避 | a-bloom-002 | git status clean |
| 1-1 | `.garden-v28a-main` z-index: 1 削除 | a-bloom-002 | globals.css 修正 |
| 1-2 | alpha を DESIGN_SPEC §1-2 同値に revert | a-bloom-002 | globals.css 修正 |
| 2 | localhost:3000 で視覚確認 | 東海林さん | OK/NG 判断 |
| 3 | OK なら commit + push | a-bloom-002 | push 完了 |
| 4 | dark 完走後、ForestGate 別ブランチ作成 + commit + push | a-bloom-002 | 別ブランチ push 完了 |
| 5 | ForestGate diff 共有 → PR 作成判断仰ぐ | a-bloom-002 → a-main-010 | PR 判断 |

## 改訂履歴

- 2026-04-28 初版（a-main-010、東海林さん「推奨で進める」承認後）
