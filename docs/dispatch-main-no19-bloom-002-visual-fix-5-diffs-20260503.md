# main- No. 19 dispatch - a-bloom-002 視覚一致 5 差分修正 - 2026-05-03

> 起草: a-main-011
> 用途: a-main-011 が Chrome MCP で両 URL スクショ取得 → 視覚比較で 5 差分特定。具体的修正指示
> 番号: main- No. 19
> 起草時刻: 2026-05-03(日) 00:42
> 緊急度: 🔴 5/5 デモ向け視覚一致最優先

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🔴 main- No. 19
【a-main-011 から a-bloom-002 への dispatch（視覚一致 5 差分修正、具体的指示）】
発信日時: 2026-05-03(日) 00:42

bloom-002- No. 11 の試作版 1:1 移植は **HTML コピペは完了したが
視覚的に試作版と一致していない**ことを a-main-011 が Chrome MCP で
直接スクショ取得 → 比較で確認しました。

東海林さんを介さず、a-main-011 が視覚判定担当します。

【視覚一致 5 差分（修正対象）】

# 1 🔥 Sidebar 左上が壊れている（最優先）

現状:
  Garden Series ロゴ画像 + Bloom テキスト + tagline + ワークボード等が
  狭い領域に重なって読めない（東海林さんスクショで確認）

期待（プロト準拠）:
  Garden Series ロゴ画像（独立配置、tagline 含む）
    ↓
  Bloom セクション（タイトルとして独立）
    ↓
  - ワークボード
  - 日報
  - 月次まとめ
  - 経営状況

修正:
  src/app/bloom/_components/BloomSidebar.tsx の HTML 構造を
  public/_proto/bloom-top/index.html の Sidebar 部分と完全に同一にする。
  CSS class 名・DOM 階層・順序すべて一致させる。

# 2 🔴 Activity Panel の時刻が桁削れ

現状:
  時刻 column が狭くて「1:30」「0:45」「0:05」と桁が消える

期待:
  「11:30」「10:45」「10:05」完全表示

修正:
  globals.css の Activity Panel 時刻 column に min-width を追加
  （プロト style.css の該当 rule を確認、min-width or width 値を厳密コピー）

# 3 🔴 Sidebar デフォルト状態が折り畳み (narrow)

現状:
  ページロード時に Sidebar が折り畳み状態
  → Bloom セクションが見えない

期待:
  ページロード時に Sidebar 展開状態（Bloom セクション + リンク 4 つ表示）

修正:
  BloomSidebar.tsx の useState 初期値を 展開（expanded = true）に変更
  または localStorage 初回値を 'expanded' に
  （ユーザーが折り畳んだ時のみ narrow 状態を localStorage 保持）

# 4 🟡 Topbar 天気「11℃ 雪」がプロトの「22℃ 晴れ」と異なる

現状:
  getWeatherByHour ロジックで深夜帯に「11℃ 雪」を返している

期待:
  プロト同等の「22℃ 晴れ」（またはプロト index.html の固定値）

修正:
  プロト側 script.js or HTML の天気値を確認、同じ mock 値に
  または getWeatherByHour ロジックをプロト準拠に修正
  （5/5 デモ時刻帯 14:00-16:00 を想定した mock 値で OK）

# 5 🟢 背景花配置の微差（優先度低）

現状:
  桜が画面上部に多く分布

期待:
  プロト同等にバランス良く分散

修正:
  globals.css の背景画像 position / size を確認、プロト準拠に
  （5/5 デモまでに余裕あれば対応、なくても致命的ではない）

【プロト確認方法】

a-bloom-002 で以下を直接読む:
- public/_proto/bloom-top/index.html
- public/_proto/bloom-top/css/style.css
- public/_proto/bloom-top/js/script.js

特に Sidebar 構造（# 1）と Activity Panel CSS（# 2）は
プロトの該当部分を **完全コピー** してください。

【削除禁止ルール継続】

- 既存の page.legacy-mixed-20260502.tsx 等は引き続き保持
- 今回の修正で BloomSidebar.tsx を更新する場合、
  現 BloomSidebar.tsx を BloomSidebar.legacy-1to1-port-20260503.tsx 等にコピー保持

【視覚一致検証フロー（重要）】

Chrome MCP は a-bloom-002 では不調と報告ありましたが、
**a-main-011 が修正後に Chrome MCP で再スクショ → 視覚一致確認**します。

a-bloom-002 の役割:
1. 修正実施（コード変更 + commit + push）
2. 完了報告（bloom-002- No. 13）+ 修正対象 5 差分への対応サマリ
3. 自セッションでは視覚確認しなくて OK（a-main-011 担当）

東海林さんへの再確認は **a-main-011 が視覚一致判定後** に最終確認のみ。

【完了報告フォーマット】

bloom-002- No. 13 で:
- commit hash + push 状態
- 5 差分への対応（# 1〜# 5 の修正内容を 1 行ずつ）
- legacy 保持ファイル（追加分）
- 完了時刻

【dispatch counter】

a-main-011: 次 main- No. 20
a-bloom-002: bloom-002- No. 13 で完了報告予定

工数見込み: 1.5-2h（# 1 が中心、# 2-3 は軽微、# 4-5 は微調整）

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 ~~~ 内をコピー |
| 2 | a-bloom-002 / Garden Bloom 002 セッションに貼り付け投下 |

→ a-bloom-002 が修正実施 + push → a-main-011 が Chrome MCP で視覚一致検証 → 一致まで修正ループ → 一致後に東海林さん最終確認。

## 修正後の検証手順（a-main-011 自身）

1. Chrome MCP tabs_context_mcp でタブ確認
2. browser_batch で navigate（localhost:3000/bloom）+ Ctrl+Shift+R + screenshot 一括
3. 既存タブ 56028362（プロト）と並列比較
4. 差分残存あれば main- No. 20 で追加修正指示
5. 視覚一致確認したら東海林さんに最終 OK 確認のみ依頼

## 改訂履歴

- 2026-05-03 00:42 初版（a-main-011、東海林さん「Claude 自身で確認してから依頼出して」指摘後、Chrome MCP で両 URL スクショ取得 → 5 差分特定 → 具体的修正指示として起草）
