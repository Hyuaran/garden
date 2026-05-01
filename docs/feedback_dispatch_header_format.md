# Memory: dispatch ヘッダー形式 v3 確定版

> dispatch / セッション間メッセージのヘッダー形式の恒久ルール。  
> 出典: a-main-010 → a-forest 横断指示（main-1、2026-05-01）  
> 反映先（a-forest）: docs/dispatch-counter.txt + 本メモリ + docs/dispatch-forest-NNN-*.md

---

## 1. 標準ヘッダー形式（3 行構成 + 空行 + 本文）

```
<アイコン> <接頭辞>-NNN
【<発信元> から <宛先> への <種別>(任意で 件名)】
発信日時: YYYY-MM-DD(曜) HH:MM

[本文 / Markdown 可]
```

実体は 4 行（1 行目: アイコン + 番号、2 行目: 関係者と種別、3 行目: 日時、4 行目: 空行）+ 5 行目以降の本文。

---

## 2. 接頭辞（モジュール / セッション）

| セッション | 接頭辞 | 例 |
|---|---|---|
| **a-forest** | **forest** | forest-1, forest-2, ... |
| a-main | main | main-1, main-2, ... |
| a-bloom | bloom | bloom-1, bloom-2, ... |
| a-tree | tree | tree-1, tree-2, ... |
| a-bud | bud | bud-1, bud-2, ... |
| a-root | root | root-1, root-2, ... |
| a-leaf | leaf | leaf-1, leaf-2, ... |
| a-soil | soil | soil-1, soil-2, ... |
| a-rill | rill | rill-1, rill-2, ... |
| a-seed | seed | seed-1, seed-2, ... |
| a-auto | auto | auto-1, auto-2, ... |

a-forest セッションでは **`forest`** を接頭辞として使用。

---

## 3. 重要度アイコン（1 行目の先頭、必須）

| アイコン | 意味 |
|---|---|
| 🔴 | 緊急（即時対応） |
| ⭐ | 重要・優先 |
| 🟡 | 中（やや優先） |
| 🟢 | 通常 |
| 📋 | 確認のみ |

---

## 4. 種別の語彙（2 行目の括弧内）

| 種別 | 用途 |
|---|---|
| dispatch | 一般的な指示・依頼の送付 |
| 受領確認 | 受領した旨を返信 |
| 進捗報告 | 中間報告 |
| 完了報告 | タスク完了の報告 |
| 質問 | 不明点の確認依頼 |
| 確認 | 軽微な確認・追認 |
| 共有 | 情報共有（指示なし） |
| 横断指示 | a-main 等から各セッションへの規定変更等 |
| 周知 | 全セッションへの一斉通知 |
| 引き継ぎ | セッション間の handoff |

種別の後に `(件名)` を任意で付与可（例: `完了報告(T-F5 閲覧 PR #64)`）。

---

## 5. 発信日時フォーマット

```
発信日時: YYYY-MM-DD(曜) HH:MM
```

- 曜日: `日`/`月`/`火`/`水`/`木`/`金`/`土`（日本語 1 文字）
- 時刻: 24 時間制 `HH:MM`
- 例: `発信日時: 2026-05-01(金) 23:55`

後追い時系列追跡のため曜日と時刻まで必須。

---

## 6. ファイル名規則

```
dispatch-<接頭辞>-<NNN>-<内容>-<YYYYMMDD>.md
```

例（a-forest）:
- `docs/dispatch-forest-1-receive-header-format-v3-20260501.md`
- `docs/dispatch-forest-2-progress-tF6-zip-design-20260502.md`

---

## 7. カウンター運用

### 7.1 カウンターファイル
**`docs/dispatch-counter.txt`**

中身は **次に使う番号** をプレーンテキストで保持（改行有無は不問、整数 1 行）。

### 7.2 開始
2026-05-01 から **forest-1** で開始。

### 7.3 発信時の手順
1. `docs/dispatch-counter.txt` を読む（次番号を取得）
2. dispatch ファイルを `dispatch-forest-<その番号>-...md` で作成
3. dispatch ファイル冒頭ヘッダーで `forest-<その番号>` を使用
4. `docs/dispatch-counter.txt` を `<その番号 + 1>` で上書き
5. commit にカウンター更新も含める

### 7.4 引き継ぎ
- a-forest → 後続セッション（a-forest-002 等）への引き継ぎ時：
  - ハンドオフ書末尾に **「dispatch counter: 次番号 NNN」** を必ず記載
- 新セッション起動時：
  - `docs/dispatch-counter.txt` に NNN を書き込んで開始
  - その後の発信は §7.3 のフローに従う

---

## 8. 発信例（a-forest）

```
🟢 forest-1
【a-forest から a-main-010 への 受領確認(dispatch ヘッダー形式 v3 採択)】
発信日時: 2026-05-01(金) 23:55

a-main-010 様

dispatch ヘッダー形式 v3 を確認・採択しました。
（本文 ...）

a-forest
```

---

## 9. 注意事項

- アイコン省略不可（必ず 1 行目先頭に付与）
- 種別の語彙は §4 の範囲内、未定義語彙は a-main に確認後に追加
- ファイル名の `<内容>` 部分は半角英数字 + ハイフンで簡潔に（日本語不可）
- カウンターは厳密増加。重複・スキップは原則回避（やむを得ない場合は handoff にメモ）

---

## 10. 改訂履歴

- v3（2026-05-01 確定）: 接頭辞 + アイコン + 種別 + 日時の 4 要素を 3 行構成で標準化、カウンター運用と引き継ぎ規定を追加
- 一次出典: a-main-010 → a-forest 横断指示（main-1）
- 反映先 memory: 本ファイル（feedback_dispatch_header_format.md）
- 反映先 a-forest 状態ファイル: docs/dispatch-counter.txt
