# dispatch main- No. 281 — claude.ai chat（Garden UI 021）へ forest-html-21 (tab-2 修正版) + forest-html-22 (tab-3 修正版) 起草依頼（bug-1 inline 削除 + bug-4 activity-icon-check 追加 + Q1 案 A 採用）

> 起草: a-main-022
> 用途: a-review review-18/19 評価結果 = bug-1 真因（handler 重複 attach、Bloom 共通 JS L210-231 既存）+ bug-4 (activity-icon-check 抽出漏れ) 必須修正 + Q1 案 A 採用（Bloom 統一維持、5/18 critical path 優先）
> 番号: main- No. 281
> 起草時刻: 2026-05-11(月) 17:30

---

## 投下用短文（東海林さんがコピー → claude.ai chat（Garden UI 021）にペースト）

~~~
🔴 main- No. 281
【a-main-022 から claude.ai chat（Garden UI 021）への dispatch（forest-html-21 + forest-html-22 修正版起草依頼、bug-1 + bug-4 必須修正 + Q1 案 A 採用）】
発信日時: 2026-05-11(月) 17:30

# 件名
forest-html-19 (tab-2) + forest-html-20 (tab-3) a-review 評価完了（review-18/19）+ **2 必須修正確定**: bug-1 handler 重複 attach（Bloom 共通 JS L210-231 既存確認、inline 削除）+ bug-4 activity-icon-check span 追加。**Q1 案 A 採用**（Bloom 統一維持、5/18 critical path 優先）+ tab-2 修正版 = forest-html-21 / tab-3 修正版 = forest-html-22 連続起草要請

# A. a-review 評価結果サマリ（review-18 + review-19）

| 評価 | tab-2 (forest-html-19) | tab-3 (forest-html-20) |
|---|---|---|
| Bloom 横断 10 観点 | 9/10 採用 / 1 NG (bug-4) | 9/10 採用 / 1 NG (bug-4 横展開) |
| 構造踏襲 C-1 共通 6 観点 | ✅ 全 OK | ✅ 全 OK |
| tab-3 独自 3 観点（パターン B + Root ミラー + 4 セクション）| - | ✅ 全 OK |
| 採用判定 | 🟡 軽微修正後採用 | 🟡 軽微修正後採用 |

# B. 🔴 bug-1 真因確定（Bloom 共通 JS 確認結果）

a-main 側で `06_CEOStatus/js/script.js` を grep 確認:

```
L209: const ACTIVITY_COLLAPSE_KEY = 'garden_activity_collapsed';
L210: const activityToggle = document.getElementById('activityToggle');
L230: if (activityToggle) {
L231:   activityToggle.addEventListener('click', (e) => {...});
```

→ **Bloom 共通 JS に activity-toggle handler が既存**。forest-html-19/20 の inline script で同じ handler を **重複 attach** → 1 click で 2 回 toggle = net 0 効果 = bug-1 完全説明。

a-review tab-3 click test で localStorage が "0" に書き込まれた事実が裏付け（handler 実行は OK だが net 効果不発）。

# C. 🔴 修正必須 2 件（tab-2/3 共通）

## C-1. bug-1 修正: inline script から activity-toggle / page-favorite-btn handler 削除

forest-html-19/20 の inline script `<script>` 内、以下ブロックを **完全削除**:

1. activity-toggle handler ブロック（`if (localStorage.getItem('garden_activity_collapsed') === '1') { ... } document.getElementById('activityToggle')?.addEventListener('click', ...) { ... }`）
2. page-favorite-btn handler ブロック（`document.querySelectorAll('.page-favorite-btn').forEach(btn => { ... })` 2 箇所）

→ Bloom 共通 JS (`06_CEOStatus/js/script.js`) の既存 handler のみに統一。これで重複 attach 解消 + 全タブ（tab-1/2/3/4-7/8 + 6 モジュール）共通解決。

**保持**: themeToggle handler / bgObserver MutationObserver / Chart.js 初期化（radar / spark / detail / monthly CF）/ 期間切替トグル handler。これら Forest 固有ロジックは inline 維持。

## C-2. bug-4 修正: activity-icon-check span 追加

activity-list 内 6 li 全てに `<span class="activity-icon-check">✓</span>` 追加。

配置位置: activity-icon と activity-body の間（Bloom 03_Workboard line 309 precedent 完全踏襲）:

```html
<li class="activity-item">
  <span class="activity-time">11:30</span>
  <span class="activity-icon"><img src="..." alt=""></span>
  <span class="activity-icon-check">✓</span>  ← 新規追加
  <div class="activity-body">...</div>
</li>
```

→ tab-2 (forest-html-21) + tab-3 (forest-html-22) 両方適用。

# D. 🟢 Q1 採択結果（5/18 critical path 優先）

| 案 | 内容 | 採択 |
|---|---|---|
| 🟢 **A** | **Bloom 統一維持**（activity-icon = bloom_*.png のまま、6 法人色化なし）| ✅ **採択** |
| 🟡 C | 6 法人色 dot/bar 装飾追加 | 不採択 |
| 🔴 B | 6 法人 PNG icon 完全切替 | 不採択 |

→ **forest-html-21/22 で activity-icon は現状維持**（bloom_ceostatus.png / bloom_monthlydigest.png / bloom_workboard.png / bloom_dailyreport.png）、追加色装飾なし。

# E. forest-html-21 (tab-2 修正版) 起草仕様

| 項目 | 内容 |
|---|---|
| ベース | forest-html-19 (tab-2 Bloom 真祖先準拠修正版、5/11 14:54 受領) |
| 修正 1 | inline script から activity-toggle / page-favorite-btn handler 削除（§C-1）|
| 修正 2 | activity-list 6 li に activity-icon-check span 追加（§C-2）|
| 内側コンテンツ | 完全踏襲（KPI 3 + ワンビュー + レーダー + 詳細チャート、変更なし）|
| 配置先 | G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\tab-2-financial-summary.html（上書き）|

# F. forest-html-22 (tab-3 修正版) 起草仕様

| 項目 | 内容 |
|---|---|
| ベース | forest-html-20 (tab-3 Bloom 真祖先準拠修正版、5/11 16:04 受領) |
| 修正 1 | inline script から activity-toggle / page-favorite-btn handler 削除（§C-1）|
| 修正 2 | activity-list 6 li に activity-icon-check span 追加（§C-2）|
| 内側コンテンツ | 完全踏襲（銀行残高 + 月次 CF + 売掛買掛 + 入出金予定 4 セクション、パターン B + Root ミラーコメント、変更なし）|
| 配置先 | G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-forest\html_drafts\chat-ui-forest-tab-3-cashflow-v1-20260511.html（上書き）|

# G. 連続送信モード

forest-html-21 送信完了後、即時 forest-html-22 連続送信。

# H. 完了報告フォーマット（forest-html-21/22）

冒頭 3 行（🟢 forest-html-21 / 元→宛先 / 発信日時）+ ~~~ ラップ + HTML 全文 ```html ~ ``` 包含 + 必須遵守チェック + 内側機能完全踏襲確認 + Bloom 4 項目修正反映確認 + § Q1 採択（案 A）反映確認 + § bug-1/bug-4 修正反映確認。

# I. tab-4-7 + 6 モジュール HTML 起草予告

forest-html-21/22 完了後、tab-4 (事業 KPI) / tab-5 (予実対比) / tab-6 (アラート・リスク) / tab-7 (レポート分析) / tab-8 (法人間取引・手元現金) + 「準備中」6 モジュール HTML（Bud / Leaf / Tree / Bloom / Fruit / Seed / Sprout / Calendar / Rill 等）の起草指示を別 dispatch で予定。

# J. 緊急度

🔴 高（後道さんデモ前 5/18 critical path、tab-4-7 + 6 モジュール起草の前提）

# K. self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用（修正案コード例は ~~~ 外）
- [x] A: a-review 評価結果サマリ
- [x] B: bug-1 真因確定（Bloom 共通 JS L210-231 確認結果）
- [x] C: 修正必須 2 件（bug-1 inline 削除 + bug-4 span 追加）
- [x] D: Q1 案 A 採択
- [x] E/F: forest-html-21/22 起草仕様
- [x] G: 連続送信モード
- [x] H: 完了報告フォーマット
- [x] I: tab-4-7 + 6 モジュール予告
- [x] 緊急度 🔴 明示
- [x] 番号 = main- No. 281（counter 継続）
~~~

---

## 詳細（参考、投下対象外）

### 1. 修正の本質

- bug-1 = 重複 attach（Bloom 共通 JS にも inline script にも同 handler）
- 修正 = inline script から削除、Bloom 共通 JS のみに統一
- 効果: tab-2/3 + tab-4-7 + tab-8 + 6 モジュール全タブで activity-toggle + page-favorite-btn が正常動作
- Bloom precedent との一貫性確保

### 2. forest-html-21/22 後の流れ

1. 配置（main 配置代行）+ ls 検証
2. a-review review-20/21 で修正反映確認
3. tab-4-7 + 6 モジュール HTML 起草指示
4. 全配置 + review → 後道さんデモ準備

### 3. bug-3 (壱の所在) は東海林さん再確認待ち

東海林さんに「お気に入りボタンの壱もおかしい」の具体所在を再確認中。本 dispatch には bug-3 修正は含めない（情報不足）。回答受領後、forest-html-23+ で対応 or 直接修正。
