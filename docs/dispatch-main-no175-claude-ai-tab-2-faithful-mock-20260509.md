# dispatch main- No. 175 — claude.ai に tab-2 財務サマリー起草指示（画像直接添付フロー、修正は対話）

> 起草: a-main-016
> 用途: claude.ai chat「Garden UI 021」に tab-2-financial-summary.html 起草指示。mock 画像踏襲 + 修正は対話で詰める方針
> 番号: main- No. 175
> 起草時刻: 2026-05-09(土) 17:47

---

## 投下用短文（東海林さんが claude.ai chat「Garden UI 021」に投下、**mock 画像も直接添付**）

~~~
🟡 main- No. 175
【a-main-016 から claude.ai chat（Garden UI 021）への dispatch（tab-2 財務サマリー起草指示）】
発信日時: 2026-05-09(土) 17:47

# 件名
tab-2-financial-summary.html を起草してください。添付の mock 画像を直接見て、忠実に HTML 化。修正点は東海林さんが直接対話で詰めます。

# 1. 起草対象

| 項目 | 内容 |
|---|---|
| 対象画像 | **東海林さんが本 dispatch と同時にアップロードする tab-2 mock 画像**（通常版 `tab-2-financial-summary.png` または v2 修正版） |
| 出力ファイル | `tab-2-financial-summary.html` |
| 配置先 | `_chat_workspace/garden-forest/html_drafts/tab-2-financial-summary.html` |

# 2. テンプレート踏襲（再記述不要、Drive read 可）

完成済 tab-1-dashboard.html を **テンプレ参照**:

```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\tab-1-dashboard.html
```

→ 以下は tab-1 と **完全に同じ**で OK（再起草不要、丸ごと流用）:
- ヘッダー（`.topbar`）= 完全同一
- 左サイドバー（`.sidebar.sidebar-dual` + nav-apps + nav-pages）= 完全同一（active 状態だけ tab-2 に変更: `<a href="?tab=2" class="nav-page-item active">`）
- 右 Activity Panel = 完全同一（内容も Forest 用 6 件そのまま）
- ページヘッダー（`.page-header`）= タイトル「**財務サマリー**」+ サブタイトル変更のみ
- データ更新ヘッダー（`.gf-update-bar`）= 完全同一
- 背景レイヤー + Forest 背景画像パス = 完全同一
- CSS 変数（gf-* / 6 法人カラー）= 完全同一
- gfShinkouGlow / gfFadeUp keyframe = 完全同一
- **テーマ切替時 Forest 背景保持 JS（MutationObserver）** = 完全同一（重要、削除しないこと）

→ 集中起草するのは **`<main>` 内の tab-2 固有セクション** のみ。

# 3. ページヘッダー文言（tab-2 用）

```html
<h1 class="page-title">
  財務サマリー <span style="color:var(--text-muted);font-size:1.6rem;">—</span>
  <span class="page-title-jp">数字の森を、深く見る</span>
  <span class="page-title-flower">...</span>
</h1>
<p class="page-subtitle">[mock 画像にあるサブタイトルがあればそれを採用、なければ簡潔に]</p>
```

# 4. 厳守事項 6 件（forest-html-7 復唱通り）

1. ウサギ描画なし（mock にあっても削除）
2. 6 法人カラー厳守
3. ヘッダー precedent
4. 左サイドバー dual nav
5. 右 Activity Panel + Forest 内容
6. mock 画像踏襲（独自セクション追加禁止）

# 5. 修正点に関する方針

| 方針 | 内容 |
|---|---|
| **a-main-016 から修正リスト事前付与しない** | 標準厳守事項 6 件のみ。それ以外は東海林さんが直接対話 |
| **画像直接添付** | claude.ai が画像を直接見て HTML 化 |
| **修正対話** | 東海林さんが起草版を見て「ここを変えて」と直接指摘 |

# 6. 配置代行フロー

1. claude.ai が tab-2 起草完了
2. forest-html-8 として dispatch 形式（~~~ ラップ + ```html ~ ``` ブロック）で全文転送
3. 東海林さんが a-main-016 にコピペ転送
4. a-main-016 が `_chat_workspace/garden-forest/html_drafts/tab-2-financial-summary.html` 配置
5. a-main-016 が Read + 仕様レイヤー評価
6. 東海林さん視覚評価 → OK → tab-3 / NG → 修正対話

# 7. 期待する応答（forest-html-8、形式厳守）

self-check 必須（main- No. 174 §3 通り）:
- [ ] 冒頭 3 行 = 🟢 forest-html-8 + 番号 + 発信日時 + 件名
- [ ] ~~~ ラップ
- [ ] 自然会話形式禁止
- [ ] HTML 全文を ```html ~ ``` ブロックで包含
- [ ] **テーマ切替時 Forest 背景保持 JS（MutationObserver）** 必須含有

# 8. 緊急度
🟡 中（5/12 までに全 7 タブ完成想定、tab-2 が 2 つ目）
~~~

---

## 詳細（参考）

発信日時: 2026-05-09(土) 17:47
発信元: a-main-016
宛先: claude.ai chat（Garden UI 021）
緊急度: 🟡 中

## a-main-016 側の準備（投下前）

1. ✅ tab-1 完成（forest-html-6 + テーマ切替 JS 追記、5/9 17:30-17:45）
2. ✅ tab-2 mock 画像 2 種配置済（通常版 + v2、`_reference/garden-forest/ui-mocks/`）
3. ✅ Garden UI 021 引き継ぎ完了（main- No. 174）

## 東海林さんの操作（claude.ai 投下時）

| 順 | 操作 |
|---|---|
| 1 | claude.ai chat「Garden UI 021」を開く |
| 2 | tab-2 mock 画像を **直接アップロード**（通常版 `tab-2-financial-summary.png` または v2 `tab-2-financial-summary-v2.png` どちらか）|
| 3 | 上記 main- No. 175 短文をコピペ投下 |
| 4 | claude.ai が forest-html-8 として tab-2 HTML 全文転送 |
| 5 | a-main-016 にコピペ転送 → 配置代行 + 評価 |

## tab-2 mock 通常版 vs v2 の選択

| 版 | 特徴 |
|---|---|
| **通常版** (`tab-2-financial-summary.png`) | a-main-015 期 5/9 04:50 東海林さん「通常版で進める、修正点は対話」指示時の対象 |
| **v2** (`tab-2-financial-summary-v2.png`) | 6 法人 → ワンビュー / レーダーチャート 名称、法人数等を上部 改訂版 |

→ 東海林さんが投下時にどちらの画像を添付するかで決定。事前判断は東海林さん専管。

## 関連 dispatch / docs

- main- No. 174（5/9 17:43）= Garden UI 020 → 021 引き継ぎ
- forest-html-7（5/9 17:45）= 引き継ぎ受領 + 待機モード
- **main- No. 175（本 dispatch）= tab-2 起草指示**
- 完成 tab-1: `_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html`
- mock 画像: `_reference/garden-forest/ui-mocks/tab-2-financial-summary{,-v2}.png`

## 改訂履歴

- 2026-05-09 17:47 初版（a-main-016、forest-html-7 受領後の tab-2 起草指示）
