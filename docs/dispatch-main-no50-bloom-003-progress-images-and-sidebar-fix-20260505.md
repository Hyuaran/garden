# main- No. 50 dispatch - a-bloom-003 /bloom/progress 不足画像 + サイドバー不整合修正 - 2026-05-05

> 起草: a-main-012
> 用途: bloom-003- No. 30 完了後 Chrome MCP 検証で 2 件の重大問題検出 → 緊急修正依頼
> 番号: main- No. 50
> 起草時刻: 2026-05-05(火) 18:37
> 緊急度: 🔴 5/8 デモ必須

---

## 投下用短文（東海林さんが a-bloom-003 にコピペ）

~~~
🔴 main- No. 50
【a-main-012 から a-bloom-003 への dispatch（/bloom/progress 不足画像 + サイドバー不整合 修正）】
発信日時: 2026-05-05(火) 18:37

bloom-003- No. 30 受領 → Chrome MCP 検証で重大問題 2 件検出。緊急修正依頼します。

【検出した問題】

# 1: iframe 内画像 126 枚中 118 枚 broken（🔴 最優先、見た目壊滅）

a-main-012 が iframe.contentDocument 経由で集計した broken 画像のディレクトリ:

| 不足ディレクトリ | 影響 |
|---|---|
| images/avatar/ | アバター画像（avatar_shoji.png 等）|
| images/header_icons/ | ヘッダーアイコン（search, calendar, weather, theme, bell, help, favorite 等）|
| images/icons_bloom/ | Bloom アイコン（bloom_workboard.png 等）|
| images/logo/ | ロゴ（logo-garden-series.png, garden_logo.png 等）|
| images/theme_icons/ | テーマ切替アイコン（theme_sun.png, theme_moon.png）|

→ 5 ディレクトリ全体を copy する必要あり。元の Drive ディレクトリには既にすべて揃っている:
`G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI_bloom\06_CEOStatus\images\`

# 2: /bloom サイドバー NAV_PAGES の不整合（🔴 デモ動線壊滅）

a-main-012 が /bloom/progress ページの DOM から allLinks 取得（4 件のみ）:

| 検出された href | 期待値 |
|---|---|
| /bloom/workboard | ✅ 既存 |
| /bloom/roadmap | ❓ **不明な link**（dispatch No. 48 では指示なし）|
| /bloom/monthly-digest | ✅ 既存 |
| /bloom/daily-reports | ❓ **複数形 s**（既存は /bloom/daily-report 単数形、bloom-003- No. 30 では「既存 4 件 + 進捗」）|

**未検出（あるべき）**:
- `/bloom/daily-report`（単数、既存 4 件の 1 つ）
- `/bloom/ceo-status`（既存 4 件の 1 つ）
- `/bloom/progress`（main- No. 48 で追加した「開発進捗」）

bloom-003- No. 30 報告との乖離:
- 報告: 「after: 5 件（既存 workboard / daily-report / monthly-digest / ceo-status + /bloom/progress）」
- 実態: 4 件（workboard / **roadmap** / monthly-digest / **daily-reports**）

→ NAV_PAGES が想定と全く違う構成になっている。要確認 + 修正。

【修正依頼】

### # 1 対応: 5 ディレクトリ画像を一括 copy

```bash
SRC="G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus"
DST="/c/garden/a-bloom-003/public/_proto/bloom-dev-progress"

mkdir -p "$DST/images/avatar" "$DST/images/header_icons" "$DST/images/icons_bloom" "$DST/images/logo" "$DST/images/theme_icons"

cp -r "$SRC/images/avatar/"*.png "$DST/images/avatar/"
cp -r "$SRC/images/header_icons/"*.png "$DST/images/header_icons/"
cp -r "$SRC/images/icons_bloom/"*.png "$DST/images/icons_bloom/"
cp -r "$SRC/images/logo/"*.png "$DST/images/logo/"
cp -r "$SRC/images/theme_icons/"*.png "$DST/images/theme_icons/"
```

注意: desktop.ini や _backup_* は copy から除外（Windows メタ + バックアップ）。`*.png` で絞ること。

### # 2 対応: BloomSidebar NAV_PAGES 確認 + 修正

`src/app/bloom/_components/BloomSidebar.tsx` の NAV_PAGES（line 65-70 付近）を確認:

期待値（5 件）:
```ts
const NAV_PAGES = [
  { href: "/bloom/workboard",      label: "ワークボード",  icon: "..." },
  { href: "/bloom/daily-report",   label: "日報",          icon: "..." },  // 単数形
  { href: "/bloom/monthly-digest", label: "月次ダイジェスト", icon: "..." },
  { href: "/bloom/ceo-status",     label: "経営状況",      icon: "..." },
  { href: "/bloom/progress",       label: "開発進捗",      icon: "/images/icons_bloom/bloom_progress.png" },  // 新規追加
];
```

a-main-012 検証で実際に出ているのは:
- workboard ✅
- **roadmap** ❓ → /bloom/progress に置き換えるべき？それとも別物？
- monthly-digest ✅
- **daily-reports**（複数形）❓ → /bloom/daily-report 単数に修正？

確認事項:
- /bloom/roadmap という path がそもそも存在するか確認（実装あれば残す、無ければ /bloom/progress に置換）
- /bloom/daily-reports は誤字 / 別実装 / typo？ /bloom/daily-report と一致させるべき
- /bloom/ceo-status が消失している原因確認 + 復活
- /bloom/progress 追加（main- No. 48 で依頼済みなのに未追加？）

### # 3 (任意): iframe 高さ調整

bloom-003- No. 30 の既知留意事項通り、`100vh` だと topbar 分隠れる可能性。視覚 NG なら:
```tsx
style={{ width: "100%", height: "calc(100vh - 64px)", border: "none" }}
```
に調整。Topbar の実高さは BloomShell のスタイルから抽出推奨。

【検証フロー（a-main-012 が再実施）】

修正後 push 受領 → Chrome MCP で:
1. iframe 内 broken 画像数 → **0** 確認
2. /bloom/progress page の allLinks に `/bloom/progress` 含む 5 件確認
3. サイドバー実クリックで /bloom/progress → 遷移成功
4. iframe 高さ調整後の視覚（任意）

【削除禁止ルール】

- BloomSidebar.tsx 編集時 legacy 必須: BloomSidebar.legacy-progress-link-add-redo-20260505.tsx
- 画像 copy は新規追加のみ、既存上書きなし

【完了報告フォーマット】

bloom-003- No. 31 で:
- commit hash + push 状態
- # 1 copy 結果（追加ファイル数 / 全 broken 解消確認）
- # 2 NAV_PAGES before/after（roadmap / daily-reports の正体含む）
- # 3 iframe 高さ調整 適用 / 見送り
- legacy 保持ファイル一覧
- 完了時刻

【dispatch counter】

a-main-012: 次 main- No. 51
a-bloom-003: bloom-003- No. 31 で完了報告予定

工数見込み: 15〜25 分（画像 copy + Sidebar 確認・修正 + iframe 調整）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 18:37 初版（a-main-012、bloom-003- No. 30 検証で重大 2 件検出後の緊急修正依頼）
