# main- No. 44 dispatch - a-bloom-003 /leaf 404 + proto/bloom-top サブナビ壊れた相対 path 修正 - 2026-05-05

> 起草: a-main-012
> 用途: 5/8 デモ向け 6 画面レビューの 🟡 残課題 #5 + #6 をまとめて修正
> 番号: main- No. 44
> 起草時刻: 2026-05-05(火) 17:13
> 緊急度: 🟡 5/8 デモ向け（3 日前、デモ時タップ可能リンクの整理）

---

## 投下用短文（東海林さんが a-bloom-003 にコピペ）

~~~
🟡 main- No. 44
【a-main-012 から a-bloom-003 への dispatch（/leaf 404 + proto/bloom-top サブナビ壊れた相対 path 修正）】
発信日時: 2026-05-05(火) 17:13

5/8 デモ向け 6 画面レビューの 🟡 残課題 2 件まとめて修正依頼。

【検出した問題】

# 5: /bloom (React) サイドバーの /leaf が 404（🟡 デモで触るリスク）

| URL | HTTP code |
|---|---|
| /fruit | 200 ✅ |
| /seed | 200 ✅ |
| /forest | 200 ✅ |
| /bud | 307 → /bud/dashboard ✅ |
| /leaf | **404** ❌ |
| /tree | 200 ✅ |
| /sprout | 200 ✅ |
| /soil | 200 ✅ |
| /root | 200 ✅ |
| /rill | 200 ✅ |
| /calendar | 200 ✅ |

→ /leaf のみ Next.js page 不在。他 11 module は最低限のページ存在（200 or 正常リダイレクト）。

# 6: /_proto/bloom-top のサブナビ 4 件が壊れた相対 path（🟡）

a-main-012 が DOM 検証で抽出した /_proto/bloom-top/index.html の uniqueHrefs:

| 現状 href | 正解（推奨） |
|---|---|
| `../03_Workboard/index.html` | `/bloom/workboard` |
| `../04_DailyReport/index.html` | `/bloom/daily-report` |
| `../05_MonthlyDigest/index.html` | `/bloom/monthly-digest` |
| `../06_CEOStatus/index.html` | `/bloom/ceo-status` |

→ proto 元 Drive 配置からの壊れた相対 path。React 本番 URL に置換すれば、proto bloom-top のサブナビからも React 本番に遷移可能（main- No. 43 で /bloom/daily-report と /bloom/ceo-status は新規作成済 = 4 リンクすべて到達可）。

【修正依頼】

### # 5 対応: /leaf placeholder 作成

`src/app/leaf/page.tsx` を新規作成。/bloom/daily-report と同等の placeholder 実装:
- ヘッダー（🌿 Garden Leaf）
- 「準備中」表示
- 関連リンク（必要に応じて関電業務委託 phase 等を案内、なければ簡素 OK）

判断基準: デモ中に /leaf に飛ばしても 404 にならないこと。

### # 6 対応: bloom-top のサブナビ 4 件 href 置換

`public/_proto/bloom-top/index.html` で 4 箇所 sed/Edit:
```
href="../03_Workboard/index.html"  → href="/bloom/workboard"
href="../04_DailyReport/index.html" → href="/bloom/daily-report"
href="../05_MonthlyDigest/index.html" → href="/bloom/monthly-digest"
href="../06_CEOStatus/index.html"  → href="/bloom/ceo-status"
```

bloom-top の他にも `_proto/` 配下で同様の壊れた相対 path があれば横断確認推奨（grep で網羅）:

```bash
grep -rn '\.\./0[3-6]_' /c/garden/a-bloom-003/public/_proto/ 2>&1 | head -20
```

【検証フロー（a-main-012 が再実施）】

修正後 push 受領 → Chrome MCP で:
1. /leaf HTTP 200 + ページレンダリング確認
2. /_proto/bloom-top/index.html の uniqueHrefs から `../03_..._06_*` 消失、`/bloom/workboard|daily-report|monthly-digest|ceo-status` 4 件出現
3. bloom-top でサブナビ実クリック → React 本番に遷移可確認（任意で 1〜2 リンク試行）

【削除禁止ルール】

- src/app/leaf/page.tsx は新規ファイルなので legacy 不要
- public/_proto/bloom-top/index.legacy-subnav-fix-20260505.html

（main- No. 41/42 で作成済 legacy も継続保持）

【完了報告フォーマット】

bloom-003- No. 28 で:
- commit hash + push 状態
- # 5 placeholder 内容（headers / 配置）
- # 6 bloom-top の置換 4 箇所 before/after
- 横断 grep の追加発見（あれば対応含む）
- legacy 保持ファイル一覧
- 完了時刻

【dispatch counter】

a-main-012: 次 main- No. 45（#3+4 garden-home orb / spin bubble dead-link 整理）
a-bloom-003: bloom-003- No. 28 で完了報告予定

工数見込み: 20〜30 分（leaf 新規 page + bloom-top 4 sed + 横断 grep）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 17:13 初版（a-main-012、5/8 デモ向け 6 画面レビュー 🟡 残課題 #5 + #6 まとめ）
