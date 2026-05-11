# main- No. 42 dispatch - a-bloom-003 href trailing slash 404 修正 - 2026-05-05

> 起草: a-main-012
> 用途: main- No. 41 修正後 Chrome MCP 検証で trailing slash 形式が 404 になることを発見、index.html 付き形式に再修正
> 番号: main- No. 42
> 起草時刻: 2026-05-05(火) 15:20
> 緊急度: 🟡 5/8 デモ向け（No.41 修正の即フォロー）

---

## 投下用短文（東海林さんが a-bloom-003 にコピペ）

~~~
🟡 main- No. 42
【a-main-012 から a-bloom-003 への dispatch（href trailing slash 404 修正）】
発信日時: 2026-05-05(火) 15:20

bloom-003- No. 25（main- No. 41 完了報告）受領 → Chrome MCP 検証で 404 問題発見。
全 4 ファイルの brand / logout href に `index.html` を追加してください。

【検出した問題】

main- No. 41 で設定した href が Next.js の trailing slash 正規化により 404 化:

| URL | HTTP code |
|---|---|
| /_proto/login/ | 308 → /_proto/login → 404 ❌ |
| /_proto/login/index.html | 200 ✅ |
| /_proto/garden-home-spin/ | 308 → /_proto/garden-home-spin → 404 ❌ |
| /_proto/garden-home-spin/index.html | 200 ✅ |

Next.js dev server (next.config の trailingSlash 既定: false) が `/dir/` → `/dir` に正規化 → そのパスが Next.js ルートにも静的ファイルにも該当せず 404。

【修正内容】

全 4 ファイルの brand / logout href に `index.html` を追加（trailing slash 形式は使わない）:

**# A: src/app/bloom/_components/BloomTopbar.tsx**
```
brand:  href="/_proto/garden-home-spin/"        → href="/_proto/garden-home-spin/index.html"
logout: href="/_proto/login/"                    → href="/_proto/login/index.html"
```

**# B: public/_proto/bloom-top/index.html**
```
brand:  href="/_proto/garden-home-spin/"        → href="/_proto/garden-home-spin/index.html"
logout: href="/_proto/login/"                    → href="/_proto/login/index.html"
```

**# C: public/_proto/ceostatus/index.html**
（B と同じ）

**# D: public/_proto/garden-home/index.html**
（B と同じ）

合計 8 箇所（4 ファイル × 2 href）の Edit。

【検証フロー（a-main-012 が再実施）】

修正後 push 受領 → Chrome MCP で:
1. 全 4 画面の brand href = "/_proto/garden-home-spin/index.html" 統一確認
2. 全 4 画面の logout href = "/_proto/login/index.html" 統一確認
3. /bloom で brand 実クリック → spin 画面到達（title "Garden Series — 遊び心 ver Final"）
4. /bloom で logout 実クリック → login 画面到達（title "ログイン — Garden Series"）

【削除禁止ルール】

新規 legacy 4 件:
- src/app/bloom/_components/BloomTopbar.legacy-href-trailing-slash-fix-20260505.tsx
- public/_proto/bloom-top/index.legacy-href-trailing-slash-fix-20260505.html
- public/_proto/ceostatus/index.legacy-href-trailing-slash-fix-20260505.html
- public/_proto/garden-home/index.legacy-href-trailing-slash-fix-20260505.html

（main- No. 41 で作成済 legacy も保持継続）

【完了報告フォーマット】

bloom-003- No. 26 で:
- commit hash + push 状態
- 各ファイル before/after の href（8 箇所）
- legacy 保持ファイル一覧
- 完了時刻

【dispatch counter】

a-main-012: 次 main- No. 43
a-bloom-003: bloom-003- No. 26 で完了報告予定

工数見込み: 10 分（4 ファイル × 2 箇所 = 8 Edit + commit + push）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 15:20 初版（a-main-012、main- No. 41 修正後 Chrome MCP 検証で trailing slash 404 問題発見後）
