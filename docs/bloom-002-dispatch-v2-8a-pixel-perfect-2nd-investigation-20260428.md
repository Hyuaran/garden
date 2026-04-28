# a-bloom-002 dispatch - v2.8a pixel-perfect 第 2 調査（CSS reset 効果なし問題）- 2026-04-28

> 起草: a-main-009
> 用途: a-bloom-002 が 0498939 で CSS reset 追加したが、東海林さんの localhost:3000 確認で「指摘箇所何も変化していない」報告 → 真の原因究明
> 前提: pixel-perfect dispatch の続き、Tailwind v4 で box-sizing は既に適用済み = reset 重複の可能性

## 投下短文（東海林さんが a-bloom-002 にコピペ）

```
【a-main-009 から a-bloom-002 へ】v2.8a pixel-perfect 第 2 調査

▼ 状況
- 0498939 (CSS reset 追加) commit 後、東海林さんが localhost:3000 確認 → 「指摘箇所何も変化していない」
- Tailwind v4 の preflight で box-sizing: border-box は既にデフォルト適用済 = reset 追加は重複で効果なし
- 真の原因は CSS reset ではない、別の箇所

▼ 真の原因仮説（優先順）

1. **component の Tailwind class / inline style が prototype と異なる**
   - 例: Sidebar.tsx で width="180px" 等、CSS 変数 var(--sidebar-w) を使っていない
   - 例: KpiCard.tsx で min-h="120px" など、prototype の 144px と違う
2. **DOM 構造が prototype と異なる**
   - prototype の `.sidebar` と Next.js 実装の同等要素が別 class
   - グローバル CSS を上書きする Tailwind class が当たっている
3. **Next.js / Turbopack の cache 問題**
   - dev server 再起動 + ブラウザ強制リロード Ctrl+Shift+R で解決する場合あり

▼ 調査手順（a-bloom-002 が実行）

Step 1: prototype の `index.html` を Edge で開き、DevTools (F12) → Inspector で **実 computed CSS** を取得

| 要素 | 確認項目 |
|---|---|
| .sidebar | width, padding, box-sizing |
| .topbar | height, padding, background |
| .kpi-card | min-height, padding, background |
| .orb-card | height, padding, background |
| .activity-panel | width, top, bottom |

Step 2: localhost:3000 で同等要素の computed CSS を取得し、**逐一比較**

Step 3: 差分があった箇所を、**component の Tailwind class / inline style** で修正

▼ 想定修正パターン

a) Tailwind class で固定値ハードコード:
   旧: <aside className="w-44 ...">  (= 176px)
   新: <aside className="w-[210px] ...">  (= 210px、prototype と一致)

b) CSS 変数を Tailwind 経由で参照:
   旧: <aside className="w-[180px]">
   新: <aside className="w-[var(--sidebar-w)]">  (＝210px)

c) inline style で修正:
   旧: <aside style={{ width: 180 }}>
   新: <aside style={{ width: 'var(--sidebar-w)' }}>

▼ 確認事項（component の現状値を確認 + 報告）

a-bloom-002 が以下を確認 + a-main-009 に報告:

1. **Sidebar.tsx の width 指定**: Tailwind class? inline style? CSS 変数参照?
2. **Topbar の height**: 同上
3. **KpiCard の高さ**: min-h-XXX? h-XXX? padding 含めた実高さ?
4. **OrbCard の高さ**: 140px 固定指定されているか?
5. **ActivityPanel の width / position**: prototype と同じ値か?
6. **ダークモード時の background 透明度**: prototype の rgba(38, 44, 32, 0.55) 等と一致しているか?

▼ Tailwind v4 + CSS 変数連携の正しい書き方（参考）

```css
/* globals.css */
:root, [data-theme="light"] {
  --sidebar-w: 210px;
  --bg-card: rgba(255, 253, 245, 0.70);
}
```

```typescript
// tailwind.config.ts (Tailwind v4 では CSS based、または PostCSS)
// CSS 変数を直接 className で利用:
<aside className="w-[var(--sidebar-w)]">
<div className="bg-[var(--bg-card)]">
```

または、`@theme inline` でマッピング:

```css
@theme inline {
  --color-bg-card: var(--bg-card);
  --width-sidebar: var(--sidebar-w);
}
```

```typescript
<aside className="w-sidebar">
<div className="bg-bg-card">
```

▼ 修正完了後

1. localhost:3000 で東海林さん再確認
2. ライト / ダーク両モード比較
3. 差分残ればさらに微調整 dispatch

▼ 注意

- 既存 globals.css の reset 追加（0498939）は冗長だが、害はない → そのまま残置 OK
- 新規修正は component 側（Sidebar.tsx / KpiCard.tsx / OrbCard.tsx / ActivityPanel.tsx 等）の class / style を主対象
- ファイル削除厳禁
- ローカル commit OK、push は GitHub Team プラン課金完了済（C 垢で push 可能）

▼ 完了報告先

修正完了 + ローカル commit + SHA 共有 + 「localhost:3000 再確認お願いします」を a-main-009 に共有。
```

## 詳細 spec

### 確認すべきファイル

| ファイル | 確認ポイント |
|---|---|
| `src/app/_components/layout/Sidebar.tsx` | width 指定方法、CSS 変数参照かハードコードか |
| `src/app/_components/layout/Topbar.tsx` | height 指定方法 |
| `src/app/_components/layout/BackgroundLayer.tsx` | 背景の透明度 / 重なり |
| `src/app/_components/home/KpiCard.tsx` | min-height / padding 値 |
| `src/app/_components/home/KpiGrid.tsx` | grid gap |
| `src/app/_components/home/OrbCard.tsx` | height（140px 固定）/ padding |
| `src/app/_components/home/OrbGrid.tsx` | grid 列数 / gap |
| `src/app/_components/home/ActivityPanel.tsx` | width / position fixed |
| `src/app/page.tsx` | layout 配置の grid / margin |
| `src/app/globals.css` | CSS 変数 + base layout class（一致確認済）|

### コミット推奨

```
fix(home): v2.8a pixel-perfect 第 2 弾 - component 側 width/height/padding を prototype に揃える
```

## 改訂履歴

- 2026-04-28 初版（a-main-009、CSS reset 効果なし問題への第 2 調査、component 側の class/style が真の原因と推定）
