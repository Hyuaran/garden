# a-bloom-002 dispatch - v2.8a ダーク透明度 詳細調査 - 2026-04-28

> 起草: a-main-009
> 用途: HTML/CSS 版のダーク = OK、Next.js 版のダーク = 透けすぎ感残る → 真の差分究明
> 前提: CSS 変数 + backdrop-filter 値は HTML/CSS prototype と byte-for-byte 一致確認済（commit 0498939 含めて）

## 投下短文（東海林さんが a-bloom-002 にコピペ）

```
【a-main-009 から a-bloom-002 へ】v2.8a ダーク透明度 詳細調査（HTML/CSS 版は OK）

▼ 状況
- 東海林さんが HTML/CSS 版（index.html）と localhost:3000 のダーク両方を比較
- HTML/CSS 版: 透けすぎ感なし、OK
- Next.js 版: 透けすぎ感残る
- CSS 変数値・backdrop-filter 値は byte-for-byte 一致確認済 → 真の差分は別要因

▼ 推定原因（優先順）

1. **data-theme="dark" 属性の付与先**
   - HTML/CSS 版: <html data-theme="dark">（line 2: <html lang="ja" data-theme="light">）
   - Next.js 版（自家製 ThemeProvider）: html / body / div どこに付与？
   - 違うと CSS 変数の cascade が想定通り効かない

2. **ATMOSPHERE_V28_NIGHT の実画像が prototype と異なる**
   - HTML/CSS 版: bg_06_night.png 1 枚固定（dark）
   - Next.js 版: ATMOSPHERE_V28_NIGHT.path = ?（同じ file?）

3. **backdrop-filter が効いていない**
   - Tailwind v4 + 自家製 ThemeProvider で blur が想定通りに効かない可能性
   - Computed style で実際の filter 値を確認

4. **複数 background レイヤーの重なり方**
   - HTML/CSS: bg-layer1 / bg-layer2 / bg-layer-overlay / body bg-paper の順
   - Next.js: 同じ DOM 構造のはずだが、Next.js の root 要素 (#__next) が間に入る可能性

▼ 調査手順（a-bloom-002 が実行）

Step 1: data-theme 属性の付与先確認

ThemeProvider が html or body or div どこに data-theme="dark" を付けているか確認:

grep -n "data-theme" src/app/_lib/theme/ThemeProvider.tsx
grep -n "data-theme" src/app/layout.tsx

prototype は <html data-theme="dark">（最上位）。**自家製 ThemeProvider が body や div につけていれば、CSS 変数の cascade が崩れる可能性**。

Step 2: ATMOSPHERES_V28_LIGHT / NIGHT の実装確認

cat src/app/_lib/background/atmospheres.ts

ATMOSPHERE_V28_NIGHT の path が prototype と同じか:
- 期待: "/images/backgrounds/bg_06_night.png"
- 実装: ?

Step 3: localhost:3000 ダーク時の Computed style 確認（東海林さん協力 or 私側で）

F12 → Inspector で以下要素の computed style を取得:
- <html> or <body>: data-theme attribute
- .topbar: background-color (実 rgba), backdrop-filter (実 blur 値)
- .kpi-card: 同上
- .orb-card: 同上
- .sidebar: 同上
- .activity-panel: 同上

Step 4: 比較 + 修正

prototype と差分があれば、その差分を埋める修正:
- ThemeProvider の付与先を <html> に統一（必要に応じて）
- ATMOSPHERE_V28_NIGHT.path を prototype と同一に
- backdrop-filter が効くよう CSS 設定確認

▼ 想定される修正パターン

a) ThemeProvider が <body> 等に data-theme を付けていた場合:
   修正: <html> に付け替える（layout.tsx で <html data-theme={theme}> のように）

b) backdrop-filter が効いていない場合:
   修正: 親要素の transform / overflow / will-change が backdrop-filter を中断していないか確認

c) どうしても prototype と一致しない場合（応急処置）:
   修正: --bg-card / --bg-sidebar / --bg-activity の dark alpha を 0.55-0.7 → 0.80-0.90 に強める
   （DESIGN_SPEC §1-2 と divergence するが視覚改善優先、後で Claude Chat に prototype も同調整依頼）

▼ 完了基準

- [ ] data-theme 付与先が <html>
- [ ] ATMOSPHERE_V28_NIGHT.path が prototype と一致
- [ ] localhost:3000 ダーク時の computed background-color / backdrop-filter が prototype と一致
- [ ] 東海林さん再確認で「透けすぎ感なし」判定

▼ 注意

- ファイル削除厳禁
- 既存 component の structure 維持（修正は theme attribute 付与先 / 画像 path 等の局所修正）
- ローカル commit OK
- 5/5 デモは HTML/CSS 版で実施するので、Next.js 側の調整は post-5/5 でも OK
- ただし「URL 化したとき劣化していないか」事前確認のため、5/5 前に解消推奨

▼ 完了報告先

修正完了 + ローカル commit + SHA 共有 + 「localhost:3000 ダーク再確認」を a-main-009 に共有。
```

## 詳細 spec

### 確認すべきファイル

| ファイル | 確認ポイント |
|---|---|
| `src/app/_lib/theme/ThemeProvider.tsx` | data-theme をどこに付けているか |
| `src/app/layout.tsx` | <html> の attribute / className |
| `src/app/_lib/background/atmospheres.ts` | ATMOSPHERE_V28_NIGHT.path |
| `src/app/page.tsx` | theme と背景画像の連携（実装済確認）|
| `src/app/globals.css` | backdrop-filter の値 / セレクタ（一致確認済）|

### 修正の際の判断基準

1. **修正で prototype と一致するなら、prototype 値を維持**
2. **修正でも一致しない場合のみ、応急処置として透明度を上げる**

### コミット推奨

```
fix(home): v2.8a ダーク透明度 - data-theme 属性の付与先 / 背景画像 path 統一
```

## 改訂履歴

- 2026-04-28 初版（a-main-009、HTML/CSS 版 OK だが Next.js 版で透けすぎ感残る → 真の原因究明）
