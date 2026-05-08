# main- No. 61 dispatch - a-bloom-003 /bloom/progress 画像 broken 90 枚 修正（base href 追加）- 2026-05-05

> 起草: a-main-012
> 用途: main- No. 60 検証で iframe src 変更により画像相対 path 解決ずれ、broken 90 枚検出 → base href で一括解決
> 番号: main- No. 61
> 起草時刻: 2026-05-05(火) 20:07
> 緊急度: 🔴 5/8 デモ向け（見栄え壊滅、即修正）

---

## 投下用短文（東海林さんが a-bloom-003 にコピペ）

~~~
🔴 main- No. 61
【a-main-012 から a-bloom-003 への dispatch（/bloom/progress 画像 broken 90 枚 修正、base href 追加）】
発信日時: 2026-05-05(火) 20:07

bloom-003- No. 34（main- No. 60 完了）受領 → Chrome MCP 検証で 1 件問題検出。即修正依頼。

【検出した問題】

iframe 内 broken 画像 **90 枚**

原因:
- iframe src が `/_proto/bloom-dev-progress/index.html` → `/api/bloom/progress-html` に変更
- 画像相対 path（`images/avatar/...`）の解決基準 base URL が `/api/bloom/` になり 404
- 例: `images/avatar/avatar_shoji.png` → `/api/bloom/images/avatar/avatar_shoji.png` ❌（実体は `/_proto/bloom-dev-progress/images/avatar/avatar_shoji.png`）

【修正案 = base href 追加】

`public/_proto/bloom-dev-progress/index.html` の `<head>` 内 1 行目あたりに base href 追加:

```html
<head>
  <meta charset="UTF-8">
  <base href="/_proto/bloom-dev-progress/">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ...
</head>
```

→ これで `images/avatar/...` は `/_proto/bloom-dev-progress/images/avatar/...` に解決される。

注意:
- `<base>` は `<head>` 内、他のリンク要素より**前**に配置必須（後方の link / img / script 等が base 解決対象）
- 既存の絶対 path（`/bloom`、`/_proto/garden-home-spin/index.html` 等）は影響なし（絶対 path は base 無視）
- API ルート（`route.ts`）の修正は**不要**（テンプレート HTML 1 ファイルのみ修正）

【検証フロー（a-main-012 が再実施）】

修正後 push 受領 → Chrome MCP で:
1. iframe 内 broken 画像数 = **0** 確認
2. 履歴カード 3 件 + モジュール 12 件 表示維持
3. v29 内 nav / sidebar の `<a>` 等のリンク先が壊れていないか（特に Bloom orb / brand link 等）

【削除禁止ルール】

- public/_proto/bloom-dev-progress/index.legacy-base-href-20260505.html（修正前を保持）
- 他は新規追加 / 1 行追加のため legacy 1 件のみ

【完了報告フォーマット】

bloom-003- No. 35 で:
- commit hash + push 状態
- index.html `<base href>` 追加 line + 全体行数 before/after
- iframe 内 broken 画像数 確認結果
- v29 内既存リンクで影響あった箇所（あれば修正併せて）/ 影響なし
- legacy 保持ファイル一覧
- 完了時刻

【dispatch counter】

a-main-012: 次 main- No. 62
a-bloom-003: bloom-003- No. 35 で完了報告予定

工数見込み: 5〜10 分（base href 1 行追加 + 動作確認）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 20:07 初版（a-main-012、main- No. 60 検証で iframe 画像 broken 90 枚検出後）
