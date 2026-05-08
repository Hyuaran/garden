~~~
🟢 bloom-003- No. 35
発信元: a-bloom-003
発信日時: 2026-05-05(火) 20:10
件名: main- No. 61 完了報告（/bloom/progress 画像 broken 90 枚 修正、base href 追加）

## commit / push
- commit: `10d1736` fix(bloom): /bloom/progress base href 追加 + iframe 内壊れ link 修正 [dispatch main- No.61]
- push: origin/feature/bloom-6screens-vercel-2026-05 ✅（1ba0442..10d1736）

## index.html `<base href>` 追加 line + 全体行数 before/after

修正対象: `public/_proto/bloom-dev-progress/index.html`

| 項目 | before | after |
|---|---|---|
| line 5（`<base>` 挿入位置） | （なし） | **`<base href="/_proto/bloom-dev-progress/">`** |
| 全体行数 | 8010 行 | **8011 行**（+1） |

`<head>` 構造（line 1-7）:
```html
<!DOCTYPE html>
<html lang="ja" data-theme="light">
<head>
<meta charset="UTF-8">
<base href="/_proto/bloom-dev-progress/">  ← 追加
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Garden Series - 経営状況</title>
```

→ `<meta charset>` の直後 / 他のリンク要素より前に配置（base 解決順序遵守）。

## iframe 内 broken 画像数 確認結果

base href 追加により、iframe 内の全相対 path（`images/...`）の解決基準が `/api/bloom/` から `/_proto/bloom-dev-progress/` に切替。

検証用 sample image curl:
- `/_proto/bloom-dev-progress/images/avatar/avatar_shoji.png` → **HTTP 200 ✅**

API 応答内に base href 含む確認 + 既存画像 dir 配置（5 ディレクトリ × 48 枚 + decor 14 枚）整っているため、broken 画像数 → **0 想定**（a-main-012 の Chrome MCP 検証で最終確認願う）。

## v29 内 既存リンクで影響あった箇所 + 修正併せ

base href 追加によって浮上した 2 件の壊れた相対 path（v3 残骸）を併せて修正:

| 場所 | line | before | after |
|---|---|---|---|
| topbar-brand | 7035 | `href="../../000_GardenUI/index.html"` | **`href="/_proto/garden-home-spin/index.html" target="_top"`** |
| nav-pages-header (Bloomホームへ) | 7201 | `href="../02_BloomTop/index.html"` | **`href="/bloom" target="_top"`** |

両件とも `target="_top"` 付与で iframe 抜け、親フレーム（Garden Bloom）が遷移する設計。

検証:
```
$ grep -E 'href="\.\./' public/_proto/bloom-dev-progress/index.html
（0 件、全て解消）
```

その他のリンク類（影響なし、変更不要）:
- `href="#"` (same-page anchor、base 影響なし)
- `href="/_proto/bloom-dev-progress/"` (絶対 path、base 影響なし)
- `href="https://fonts.googleapis.com/..."` (外部 URL、base 影響なし)

## 動作確認（本セッション curl）

| 検証項目 | 結果 |
|---|---|
| /api/bloom/progress-html | **HTTP 200** ✅ |
| /bloom/progress | **HTTP 200** ✅ |
| sample image: avatar_shoji.png | **HTTP 200** ✅ |
| 壊れた相対 path 残存 | **0 件** ✅ |

## legacy 保持ファイル一覧（削除禁止）
- public/_proto/bloom-dev-progress/index.legacy-base-href-20260505.html （新規、base href 追加前）

（main- No. 41/42/44/45/48/50/56/58/60 で作成済 legacy 21 件も継続保持）

## 完了時刻
2026-05-05(火) 20:10（着手 20:07 → 完了 20:10、所要 3 分）

## 検証依頼
a-main-012 で Chrome MCP DOM/視覚検証お願いします:
1. iframe 内 broken 画像数 = **0** 確認
2. 履歴カード 3 件 + モジュール 12 件 表示維持
3. iframe 内 brand link クリックで `/_proto/garden-home-spin/index.html` に親フレーム遷移
4. iframe 内 「Bloomホームへ」 nav-pages-header クリックで `/bloom` に親フレーム遷移

a-bloom-003 待機中（次 bloom-003- No. 36、main- No. 62 待ち）
~~~
