# v2.8a dark backdrop-filter 犯人調査レポート — 2026-04-28

> 起草: a-bloom-002
> 受領 dispatch: a-main-010/docs/bloom-002-dispatch-v2-8a-dark-backdrop-filter-fix-20260428.md
> 受領: 2026-04-28

---

## 結論サマリ（東海林さん向け）

**犯人の最有力候補を静的解析で特定**: `<main class="garden-v28a-main">` の `position: relative + z-index: 1` の組み合わせが**スタッキングコンテキストを形成**し、その内部の `.kpi-card` / `.orb-card` の `backdrop-filter` を nullify しています。

これにより blur が効かず、bg 画像が card の透過部分を通じて**鮮明に**見える → 「透けすぎ感」の正体です。alpha を 0.94 まで上げても残った 6% を bg 鮮明画像が透過するため目立つ仕組み。

---

## §調査手順 1 / 2 結果（静的解析）

DevTools 操作は東海林さんに委譲する形ですが、ソースコード全件 grep で**犯人候補は静的に特定可能**でした。

### §補足 A: globals.css 全件 grep 結果

`grep -nE "transform|will-change|filter|perspective|contain|isolation" src/app/globals.css` で抽出した backdrop-filter ブロッカ候補:

| Line | セレクタ | プロパティ | v2.8a homepage で使用？ |
|---|---|---|---|
| 281 | `.gv-slot` | `will-change: transform, filter` | ❌ Bonsai View 用、v2.8a homepage では未使用 |
| 417 | `.v7d-hit` | `transform: translate(...)` | ❌ V7-D hit area 用、v2.8a homepage では未使用 |
| **932** | **`.garden-v28a-main`** | **`position: relative; z-index: 1;`** | ✅ **使用中（page.tsx の `<main>` ）** |
| 1129 | `.orb-card` | `transition: transform...` (transition のみ、犯人ではない) | ✅ |
| 982 | `.kpi-card` | `transition: transform...` (transition のみ、犯人ではない) | ✅ |

→ **唯一の祖先要素レベルの犯人**: `.garden-v28a-main` の `z-index: 1`。

### DOM ツリー祖先解析（v2.8a homepage）

```
<html data-theme="dark" class="...font-vars... h-full antialiased">  ← stacking context: なし
  <body class="min-h-full flex flex-col">                              ← position: relative (z-index なし) → SC なし
    <ThemeProvider>          [DOM ラッパーなし、Context のみ]
      <ShojiStatusProvider>  [DOM ラッパーなし、Context のみ]
        <BackgroundLayer />    [3 div fixed, z-index: 0]
        <Topbar />             [.topbar fixed, z-index: 9]
        <Sidebar />            [.sidebar fixed, z-index: 8]
        <main class="garden-v28a-main">  ← ★犯人★ position: relative + z-index: 1 → SC 形成
          <Greeting />
          <KpiGrid>            [.kpi-grid 内に .kpi-card × 4 — backdrop-filter: blur(8px)]
          <OrbGrid>             [.orb-grid 内に .orb-card × 12 — backdrop-filter: blur(8px)]
        </main>
        <ActivityPanel />      [.activity-panel fixed, z-index: 5]
```

**spec 解釈**:
- backdrop-filter は「祖先のスタッキングコンテキストの paint 結果」をブラする
- main が SC を形成している → 内部 card の backdrop = main の paint 範囲（透明背景）
- bg-layer (z-index: 0) は main の SC 外なので backdrop には含まれない
- → blur 対象が透明 = **blur 効果なし** = bg 画像が鮮明に透過

### Activity Panel / Topbar / Sidebar の状況

これら 3 つは `<body>` 直下で main の SC 外。

- `<body>` の `position: relative` は z-index なしのため SC を形成**しない**（CSS spec）
- → これら 3 つの backdrop-filter は viewport 全体（bg-layer 含む）を正しく blur できる**はず**

→ **実は Topbar / Sidebar / Activity Panel の backdrop-filter は機能している可能性が高い**。
ただし KPI / Orb cards が bg を鮮明透過 → 視覚的に「全体が透けて見える」錯覚を引き起こしている可能性。

---

## §犯人特定結果まとめ

| 候補 | 影響範囲 | 確度 |
|---|---|---|
| ★ `.garden-v28a-main` の `z-index: 1` | KPI cards 4 + Orb cards 12（合計 16 要素） | 🔴 **高**（静的解析で特定） |
| `body` の `overflow-x: hidden` | 全要素（理論的） | 🟡 中（Safari 旧版で報告例あり、Chrome では通常問題なし） |
| `body` の `position: relative` | 全要素（z-index なしのため通常 SC 形成せず） | 🟢 低 |

---

## §東海林さんへの選択肢提示

### A 案: `.garden-v28a-main` から `z-index: 1` を削除（推奨）⭐

```css
.garden-v28a-main {
  margin-left: var(--sidebar-w);
  padding: calc(var(--topbar-h) + 24px) 32px 32px;
  position: relative;
  /* z-index: 1; ← 削除 */
}
```

**メリット**:
- 最小修正、prototype と同じ挙動に近づく
- KPI / Orb の backdrop-filter が機能再開
- alpha を 0.55-0.7 に戻せる

**デメリット**:
- main 配下の重なり順が意図通りか要確認（Topbar:9 / Sidebar:8 / ActivityPanel:5 / bg:0 で main 子要素が間に入っても、子要素は通常 stacking context 順で問題なし）
- prototype の main にも z-index: 1 がある場合は別の修正が必要（prototype 確認が必須）

### B 案: card 各要素に `isolation: isolate` 付与（祖先削除不可の場合の最終手段）

```css
.activity-panel,
.topbar,
.sidebar,
.kpi-card,
.orb-card {
  isolation: isolate;
}
```

**メリット**:
- 祖先構造を変えずに card 自身が独立 SC を形成、祖先の影響を切る
- 確実に動作する

**デメリット**:
- 厳密には isolation は backdrop-filter を壊す側のプロパティ（自己 SC 形成）
- → 自分自身の SC を作っても意味がない可能性あり、要 DevTools 検証

⚠️ **B 案はテスト要**: `isolation: isolate` を card 自身につけても、card の backdrop は親 SC（main）の paint なので解決しない可能性がある。**A 案優先**。

### C 案: 祖先構造変更（main を排除して全 card を body 直下に並列）

**メリット**: 確実に解消
**デメリット**: 大規模変更、レイアウト崩れリスク高、5/5 デモ前は推奨せず

---

## §a-bloom-002 推奨アクション

1. **A 案採用**を推奨（最小修正、確度高）
2. prototype `.garden-v28a-main` の z-index 値を Claude Chat 経由で確認（HTML 版で動いている = z-index: 1 はないはず）
3. A 案実装 + alpha を 0.55 / 0.6 / 0.7 に revert
4. localhost:3000 で東海林さん再確認
5. 解消すれば commit + push（msg: `fix(home): v2.8a [dispatch v2.8a 第 3 弾] z-index 削除で backdrop-filter 復活 + alpha 元値復帰`）
6. 解消しなければ B 案（isolation）→ それでも駄目なら C 案

---

## §補足: 既存 commit との関係

- `d080e45` (alpha 0.82) — 第 1 弾応急処置、A 案成功時に revert
- `333ecef` (alpha 0.94) — 第 2 弾応急処置、A 案成功時に revert
- A 案実装時、両 commit を revert + 新 commit で alpha を 0.55 / 0.6 / 0.7 に戻す統合修正を行う（git revert ではなく直接編集で 1 commit にまとめる）

---

## §東海林さんへの DevTools 検証依頼（補強）

可能であれば以下も実施いただけると確証が得られます:

1. localhost:3000 ダーク表示
2. F12 → Elements で `<main class="garden-v28a-main">` を選択 → Computed タブで `z-index: 1` 確認
3. `.kpi-card` を選択 → Computed タブで `backdrop-filter` を確認
   - もし `none` または効いていない値 → 仮説確定
   - もし `blur(8px)` で効いているように見える → 別原因

ただし**静的解析で犯人候補がほぼ特定できた**ため、A 案先行実装を推奨します。

---

## 改訂履歴

- 2026-04-28 初版（a-bloom-002、dispatch v2.8a 第 3 弾受領後、静的解析完了）
