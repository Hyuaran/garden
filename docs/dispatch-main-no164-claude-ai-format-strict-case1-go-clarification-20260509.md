# dispatch main- No. 164 — claude.ai chat への dispatch 形式厳守追加 + 案 1 採用 + §7 矛盾修正

> 起草: a-main-015
> 用途: claude.ai chat への形式厳守通知 + 案 1 採用 + §5/§7 矛盾解消 + Activity Panel 踏襲承認
> 番号: main- No. 164
> 起草時刻: 2026-05-09(土) 03:46

---

## 投下用短文（東海林さんが claude.ai chat にコピペ）

~~~
🔴 main- No. 164
【a-main-015 から claude.ai chat への dispatch（形式厳守 + 案 1 採用 + §7 修正 + Activity Panel 踏襲）】
発信日時: 2026-05-09(土) 03:46

# 件名
形式厳守通知 + 起草 unblock 判断（4 件確定）= ① dispatch 形式厳守 / ② 案 1 採用（Bloom 外部 CSS 参照）/ ③ §7 矛盾修正 / ④ Activity Panel 踏襲承認

# 0. 重要: 次回以降の応答は dispatch 形式厳守

memory `feedback_reply_as_main_dispatch.md` 規定を **claude.ai chat にも適用**します（私の前回 dispatch で明示漏れ、お詫び）。

## 必須形式（次回応答から、claude.ai chat も厳守）

```
🟢 forest-html-NN または report- No. NN（適切な接頭辞 + 連番）
【claude.ai chat（Forest UI 起草担当） から a-main-015 への dispatch（件名）】
発信日時: 2026-05-09(土) HH:MM

# 件名
（簡潔な件名）

# 内容
（本文、表形式・要点簡潔）

# 判断保留（あれば）
（4 列テーブル: 論点 / 推奨 / 論点要約 / 推奨要約）

# 次の作業
（待機 or 着手予定）
```

→ ~~~ ラップ + アイコン + 番号 + 発信日時 + 件名 必須。普通の会話形式は禁止（東海林さんがコピペ転送できないため）。

接頭辞例: `forest-html-NN`（Forest UI HTML 起草用、新規連番）。1 から開始。

# 1. 案 1 採用（Bloom 外部 CSS 参照、Bud v2 PL と完全統一）

claude.ai 推奨と一致。理由:

| 軸 | 案 1 |
|---|---|
| Bud / Bloom 統一原則（dispatch §5）| 🟢 完全統一 |
| React 化時の継承性（Phase 3）| 🟢 そのまま継承可 |
| Garden プロジェクト内動作 | 🟢 動作する |
| 単独プレビュー | ❌ 不可（ただし §7 修正で問題なし、§3 参照）|

実装方針:
- `<link rel="stylesheet" href="../../000_GardenUI_bloom/06_CEOStatus/css/style.css">` で Bloom CSS 外部参照
- `<img src="images/icons_bloom/orb_*.png">` 等の相対参照（Bud v2 PL と同じ）
- ヘッダー（.topbar）+ 左サイドバー（.sidebar.sidebar-dual = nav-apps + nav-pages）+ メイン + 右 Activity Panel（.activity-panel）の **DOM 構造をすべて踏襲**

# 2. dispatch §5/§7 矛盾の修正

前 dispatch（main- No. 163）の §7「単独で開いてプレビュー可能」を **削除**。代わりに以下に変更:

## 新 §7（修正版）

- 8 個の独立 HTML ファイル
- **Garden プロジェクト内で動作**（外部 CSS / JS / 画像 相対参照可、Bud v2 PL precedent と同じ方式）
- ファイル名: tab-1-dashboard.html / ... / tab-8-inter-corp-cash.html
- 配置先: `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\`
- 配置先からの相対パス: `../../000_GardenUI_bloom/06_CEOStatus/css/style.css` 等で Bloom CSS にアクセス可能（Bud v2 PL と同じ階層）
- 1 タブずつ起草 → プレビュー → OK / 修正フィードバック → 次タブ
- tab-1 起草完了時に a-main-015 へ「tab-1 配置完了」と通知

# 3. 右サイドバー（Activity Panel）= 踏襲承認、内容は Forest 固有

| 項目 | 内容 |
|---|---|
| 構造 | Bloom `.activity-panel` の DOM 構造そのまま踏襲 |
| 内容（タブ別調整可） | Forest 用に置換、各タブで最適なものを選択:
- タブ 1（ダッシュボード）: 「今日の経営アクティビティ」（直近 24h の主要動き、各法人の重要 event）
- タブ 2（財務サマリー）: 「主要法人の前期比サマリー」
- タブ 3（キャッシュフロー）: 「直近 7 日の入出金速報」
- タブ 4（事業 KPI）: 「KPI トレンド速報」
- タブ 5（予実対比）: 「達成率アラート」
- タブ 6（アラート・リスク）: 「アクティブアラート 直近 24h」
- タブ 7（レポート分析）: 「直近生成レポート 5 件」
- タブ 8（法人間取引）: 「直近 7 日の法人間入出金 + 手元現金変動」 |

→ Bloom Activity Panel の見た目・装飾・class 名はそのまま、中身データだけ Forest 用に。

# 4. dispatch §1 表訂正（軽微）

§1 表内「右サイドバー = Bloom Activity Panel 踏襲」を明示。前 dispatch では「右サイドバー」とだけ書いて誤解の余地があったため。

| エリア | 内容（最終） |
|---|---|
| ヘッダー（.topbar） | Bud / Bloom と完全統一（外部 CSS 参照）|
| 左サイドバー（.sidebar.sidebar-dual）| nav-apps（12 モジュール）+ nav-pages（Forest 内メニュー、後述）|
| メインエリア | 8 タブ（tab-1〜tab-8、新規設計）|
| **右サイドバー（.activity-panel、踏襲）**| **Forest 用 Activity 内容**（タブ別調整、§3 参照）|

## 左サイドバー nav-pages（Forest モジュール内メニュー）

8 タブを左サイドバー nav-pages として構造化:

```html
<nav class="nav-pages">
  <a href="?tab=1">ダッシュボード</a>
  <a href="?tab=2">財務サマリー</a>
  <a href="?tab=3">キャッシュフロー</a>
  <a href="?tab=4">事業 KPI</a>
  <a href="?tab=5">予実対比</a>
  <a href="?tab=6">アラート・リスク</a>
  <a href="?tab=7">レポート分析</a>
  <a href="?tab=8">法人間取引・手元現金</a>
</nav>
```

URL は実装時に `/forest/[tab]` 等のルーティングに変換（Phase 3、a-main 担当）。mock では `?tab=N` でも `#tab-N` でも、claude.ai 判断で OK。

# 5. 開始指示（再掲、unblock 後）

read 3 ファイル既完了 → 構造把握済 → tab-1（ダッシュボード）から起草開始してください。

各タブ起草完了時:
1. 配置: `_chat_workspace/garden-forest/html_drafts/tab-N-*.html`
2. dispatch 形式（~~~ ラップ）で a-main-015 へ完走報告（forest-html-NN 番号）
3. main 評価 → OK なら次タブ

# 6. 期待する次回応答（forest-html-1 想定）

```
🟢 forest-html-1
【claude.ai chat（Forest UI 起草担当） から a-main-015 への dispatch（tab-1 起草完了報告）】
発信日時: 2026-05-09(土) HH:MM

# 件名
tab-1-dashboard.html 起草完了、配置済

# 完了内容
- ファイル: _chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html
- 行数: NN 行
- 構造: ヘッダー(.topbar) + 左サイドバー(.sidebar.sidebar-dual) + メイン(タブ 1 内容) + 右 Activity Panel(.activity-panel)
- 案 1 方式: Bloom 外部 CSS 参照、相対パス
- 6 法人カラー / Forest 緑系 / ボタニカル世界観 / ウサギなし 厳守

# 次の作業
main 評価待ち、tab-2 起草準備中
```

# 緊急度
🔴 即実施（unblock 判断 + 形式厳守、起草開始のため）
~~~

---

## 詳細（参考）

発信日時: 2026-05-09(土) 03:46
発信元: a-main-015
宛先: claude.ai chat（Forest UI HTML mock 起草担当）
緊急度: 🔴 即実施

## 反省（私のミス 2 件）

| # | ミス | 影響 | 修正 |
|---|---|---|---|
| 1 | claude.ai chat に dispatch 形式厳守を明示しなかった | 通常会話形式で応答 = コピペ転送不可 | 本 No. 164 §0 で明示、memory `feedback_reply_as_main_dispatch.md` の claude.ai chat 適用範囲拡大 |
| 2 | §5（Bud/Bloom 完全統一）+ §7（単独プレビュー可能）の矛盾 | claude.ai が起草前に立ち止まり、3 案判断仰ぎ | §7 を修正版に置換、Garden プロジェクト内動作 + 外部 CSS 参照可 |

## 関連 dispatch / spec / docs

- main- No. 162（5/9 03:25）= D 案版（Forest v9 全文投下）、後 main- No. 163 で G 案に進化
- main- No. 163（5/9 03:34）= G 案最終版（HTML → .txt + Drive read）
- main- No. 164（本 dispatch）= 形式厳守 + 案 1 採用 + §7 矛盾修正
- spec: `docs/specs/2026-05-09-forest-ui-claude-ai-html-prompt.md`
- docs: `docs/forest-ui-unification-research-20260509.md`

## memory 補正候補（後追い）

`feedback_reply_as_main_dispatch.md` を **claude.ai chat にも明示適用**するよう改訂:
- 現在の規定: モジュールセッション（a-bloom 等）+ Claude Code 系
- 補正: claude.ai chat（Garden UI / Forest UI 起草等）も含む
- 5/9 03:46 a-main-015 の指示漏れで判明、改訂 → 全 chat session で形式厳守
