# a-bloom-002 dispatch - Step G 解析結果 + Step H/I 判定依頼 - 2026-05-01

> 起草: a-main-010
> 用途: Console JS 出力（Step F）の解析結果を a-bloom-002 にリレー、即実装依頼
> 前提: 東海林さん Step F Console JS 実行完了、出力 JSON 受領

---

## Step F 出力（東海林さん受領）

```json
{
  ".kpi-card_self_backdropFilter": "none",
  ".kpi-card_blockers": [
    { "tag": "DIV", "class": "kpi-card", "prop": "transform", "value": "matrix(1, 0, 0, 1, 0, 0)" }
  ],
  ".orb-card_self_backdropFilter": "none",
  ".orb-card_blockers": [
    { "tag": "A", "class": "orb-card", "prop": "transform", "value": "matrix(1, 0, 0, 1, 0, 0)" }
  ],
  ".activity-panel_self_backdropFilter": "none",
  ".activity-panel_blockers": [
    { "tag": "ASIDE", "class": "activity-panel", "prop": "transform", "value": "matrix(1, 0, 0, 1, 0, 0)" }
  ]
}
```

## a-main-010 解析（重大発見 2 つ）

### 発見 1: `_self_backdropFilter: "none"` （3 selector で共通）

**深刻**。CSS では `backdrop-filter: blur(8px)` (kpi/orb) / `blur(16px)` (activity) を明確に定義しているにもかかわらず、Computed value が `"none"` になっている。

a-bloom-002 worktree `globals.css` 確認（a-main-010 から）:
- 行 974: `.kpi-card { ... backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); ... }`
- 行 1118: `.orb-card { ... backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); ... }`
- 行 1238: `.activity-panel { ... backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); ... }`

→ CSS 配線レベルで **何かが上書きして `none` にしている**。

#### 原因仮説（優先順）

| 仮説 | 確度 | 検証方法 |
|---|---|---|
| A. **Tailwind v4 preflight が `backdrop-filter` を reset** | 高 | `@layer base` の Tailwind preflight 確認、specificity 比較 |
| B. CSS cascade で後段に `backdrop-filter: none` が紛れている | 中 | globals.css 全件 grep `backdrop-filter` |
| C. element に **inline `style="backdrop-filter: none"`** が付いている | 低 | DevTools Elements で element 直接確認 |
| D. ブラウザのレンダリング能力不足 / GPU acceleration 切れ | 低 | Chrome のハードウェアアクセラレーション設定 |

### 発見 2: blockers に **要素自身（self）の transform: matrix(1, 0, 0, 1, 0, 0)**

`matrix(1, 0, 0, 1, 0, 0)` = identity 行列（実質 transform なし）。これは globals.css 行 1425-1445 の **animation: fadeUp** によるもの:

```css
.kpi-card   { animation: fadeUp 0.7s ease both; }
.orb-card   { animation: fadeUp 0.6s ease both; }
.activity-panel { animation: fadeUp 0.8s ease both; animation-delay: 0.5s; }
```

`animation-fill-mode: both` で、fadeUp keyframe の最終 transform が animation 終了後も残存し、要素自身に `transform: matrix(...)` が computed として残る。

→ 要素自身が SC（スタッキングコンテキスト）形成 = **本来 backdrop-filter は self の SC 内で blur をかける** が、_self_backdropFilter が none なので発見 1 が真因。発見 2 は副因。

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
【a-main-010 から a-bloom-002 へ Step G/H 解析結果】

Console JS 出力受領、解析完了。重大発見 2 つ。

【発見 1: _self_backdropFilter: "none" 全 3 selector 共通】（深刻）
CSS で backdrop-filter: blur(...) を定義しているのに Computed が "none"。
→ Tailwind v4 preflight が reset している可能性が極めて高い

【発見 2: 要素自身に transform: matrix(1, 0, 0, 1, 0, 0)】（副因）
animation: fadeUp ... both の最終 keyframe が残存。要素自身が SC 形成だが、
本来 backdrop-filter は self SC 内で機能する → 発見 1 が真因

【Step H 依頼: 即実施】

1. Tailwind v4 preflight 確認:
   cd /c/garden/a-bloom-002
   grep -rn "backdrop-filter" node_modules/tailwindcss/dist/ 2>/dev/null | head -20
   grep -rn "backdrop-filter" src/app/globals.css

2. globals.css 全件 grep で backdrop-filter の重複確認:
   grep -nE "backdrop-filter|backdrop-blur" src/app/globals.css

3. 上記で原因特定したら、対応案を a-main-010 に報告:
   - Tailwind preflight が原因 → @layer base override or !important で復活
   - 重複定義が原因 → 後段の "none" を削除
   - その他 → 別調査

【Step I バックアップ案】

もし Step H で解決困難なら:
- .kpi-card / .orb-card / .activity-panel に backdrop-filter !important 追加
- または -webkit-backdrop-filter のみ残して標準を消す（Chrome 古い挙動の可能性）

【追加情報】
発見 2 の transform は animation: fadeUp の `both` 由来。
これは触らない（5/5 デモのアニメーション演出を維持）。
SC 形成自体は backdrop-filter の妨げにならない（self SC 内で機能する仕様）。

【完了報告期待】
1. Step H grep 結果（Tailwind preflight に backdrop-filter reset があるか / 重複定義の有無）
2. 原因特定
3. 対応案実装
4. 東海林さん再確認（hard refresh で確認）
5. OK なら commit + push
~~~

---

## 詳細手順（参考）

### Step H: 原因特定 grep

```bash
cd /c/garden/a-bloom-002

# Tailwind v4 preflight 確認
grep -rn "backdrop-filter" node_modules/tailwindcss/dist/ 2>/dev/null | head -20

# globals.css 全件 grep（backdrop-filter / backdrop-blur）
grep -nE "backdrop-filter|backdrop-blur" src/app/globals.css

# inline style 確認（page.tsx 等）
grep -rnE "backdropFilter|backdrop-filter" src/app/page.tsx src/app/_components/ 2>/dev/null
```

### Step H 対応案

| 原因 | 対応 |
|---|---|
| Tailwind v4 preflight reset | `@layer components` で `.kpi-card { backdrop-filter: blur(8px); }` を再定義 |
| globals.css 内重複定義 | 後段の `backdrop-filter: none` を削除 |
| inline style 上書き | element 側の `style={{ backdropFilter: '...' }}` 修正 |

### Step I バックアップ案（!important）

最終手段（CSS specificity battle 勝ち確実）:

```css
.kpi-card {
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
}
.orb-card {
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
}
.activity-panel {
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
}
```

→ ただし `!important` は最終手段、Step H で根本原因解決を優先。

## 改訂履歴

- 2026-05-01 初版（a-main-010、Console JS 出力受領後の即解析）
