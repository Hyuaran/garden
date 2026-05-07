# dispatch main- No. 101 — 横断（全モジュールセッション）：RTK 効果共有 + 全セッション適用確認

> 起草: a-main-013（コンテキスト 82% で a-main-014 引継ぎ前最終 dispatch）
> 用途: 全モジュールセッション宛 横断「RTK 64.9% 削減効果共有 + 各セッションで動作確認 + 既に global hook 適用済の周知」
> 番号: main- No. 101
> 起草時刻: 2026-05-07(木) 20:18

---

## 投下用短文（東海林さんが各モジュールセッションにコピペ、宛先別 1 通ずつ）

### 共通文（全宛先で同文、宛先名のみ書き換え）

~~~
🟢 main- No. 101
【a-main-013（→ 014）から a-XXXX への 横断指示（RTK 64.9% 削減効果共有 + 各セッション適用確認）】
発信日時: 2026-05-07(木) 20:18

a-main-013 で計測した結果、**RTK が 5/6-5/7 で 64.9% トークン削減**（476.3K 節約）達成しました。CLAUDE.md §19 目標 30-50% を大幅超えで、ガンガン常態モード初日（24 dispatch + 各セッション 40+ commits）が成立した重要要因です。

詳細は以下ファイル参照:
[docs/dispatch-main-no101-rtk-cross-modules-broadcast-20260507.md](docs/dispatch-main-no101-rtk-cross-modules-broadcast-20260507.md)

## 重要：RTK は既に全セッションに自動適用済

5/5 夜に a-main で `rtk init -g --auto-patch` 実施 = **`~/.claude/settings.json` の global hook 設定済**。

→ a-XXXX を含む **全 Claude Code セッションで自動的に rtk 経由**で動作中。明示的に有効化する作業は不要。

## 各セッションでの確認方法

**1. 動作確認（30 秒）**:
```
git status
```
出力が圧縮形式（`* branch / clean — nothing to commit` の短い形）なら RTK 動作中。通常形式（`On branch ... nothing to commit, working tree clean`）なら未適用。

**2. 削減実績確認**:
```
rtk gain
```
Total commands と Tokens saved を確認。Hook 設定済なら自動カウント。

**3. 設定確認**:
```
rtk init -g --show
```
`Hook: rtk hook claude (native binary command)` が `[ok]` なら全モジュール適用済。

## 万が一未適用の場合

各モジュールで以下実行（東海林さんに別 PowerShell 依頼推奨、CLAUDE.md npm install deny 同様）:
```
rtk init -g --auto-patch
```
完了後、Claude Code セッション再起動で反映。

## 効果実証（5/6-5/7 a-main-013 計測）

| 指標 | 値 |
|---|---|
| 総コマンド | 765 件 |
| 削減トークン | **476.3K（64.9%）** |
| 高削減コマンド | rtk lint eslint 99.6% / rtk vitest run 99.7% / rtk git pull 99.5% / rtk curl 98.3% |

→ ガンガン常態モードでの大量コマンド実行（git status / grep / find / read / vitest / npm 等）で **平均 64.9% 削減**、コンテキスト消費を半分以下に抑制。

## 確認 / 報告

各セッションで以下を確認:
1. `git status` 出力が圧縮形式 ✅（既動作）
2. `rtk gain` で各セッションの累計削減確認
3. もし未適用なら東海林さん経由で `rtk init -g --auto-patch` 依頼

確認結果は次回の進捗報告 dispatch で「RTK 動作確認 ✅」または「未適用 → 対応依頼」を 1 行付記。

ガンガン常態モード継続、引き続きよろしくお願いします。
~~~

---

## 1. 背景

### 1-1. 東海林さん指摘（20:14）

> これだけ削減できているなら RTK を main セッションだけではなく、他モジュールセッションにも適用してほしいと main014 に伝えたい。

→ a-main-013 で 64.9% 削減実証 + 横断適用希望。

### 1-2. RTK 適用状況（実態）

5/5 夜に a-main で `rtk init -g --auto-patch` 実施済:
- `~/.claude/settings.json` に global hook 設定
- **全 Claude Code セッションで自動適用**（a-bloom-004 / a-bud / a-soil / a-leaf-002 / a-root-002 / a-tree / a-forest-002 全部含む）

→ **既に全モジュール適用済**だが、各セッションが認識していない可能性。本 dispatch で明示的に共有。

### 1-3. RTK 効果実証（5/6-5/7、a-main-013 計測）

```
rtk gain
Total commands:    765
Input tokens:      733.3K
Output tokens:     258.6K
Tokens saved:      476.3K (64.9%)
Total exec time:   204m49s (avg 16.1s)
Efficiency meter: ████████████████░░░░░░░░ 64.9%
```

CLAUDE.md §19 目標 30-50% を 14.9-34.9pt 超え。

---

## 2. 各セッションでの確認手順

### 2-1. 動作確認（30 秒）

```bash
git status
```

| 出力形式 | 判定 |
|---|---|
| `* branch / clean — nothing to commit` | ✅ RTK 動作中 |
| `On branch ... nothing to commit, working tree clean` | ⚠️ RTK 未適用 |

### 2-2. 削減実績確認

```bash
rtk gain
```

各セッション独自の累計削減を確認。Hook 設定済なら自動カウント。

### 2-3. 設定確認

```bash
rtk init -g --show
```

期待出力:
```
[ok] Hook: rtk hook claude (native binary command)
[ok] RTK.md: ...
[ok] Global (~/.claude/CLAUDE.md): @RTK.md reference
[ok] settings.json: RTK hook configured
```

`[ok] Hook: ...` あれば適用済。`[--] Hook: not found` なら未適用。

---

## 3. 万が一未適用の場合の対処

global hook は `~/.claude/settings.json` 設定なので、通常は全セッション自動適用。万が一未適用の場合:

```powershell
# 東海林さん別 PowerShell で実行（CLAUDE.md npm install deny 同様）
rtk init -g --auto-patch
```

完了後、該当 Claude Code セッションを再起動（× 閉じて再起動）で反映。

---

## 4. 高削減コマンド Top 10（参考、5/6-5/7 累計）

| 順 | コマンド | 削減 | 削減率 | 用途 |
|---|---|---|---|---|
| 1 | rtk lint eslint | 181.1K | 99.6% | ESLint 実行（a-bloom-004 / a-bud で多用）|
| 2 | rtk read | 96.1K | 23.3% | ファイル読込（全セッション）|
| 3 | rtk grep | 67.9K | 14.4% | パターン検索（全セッション）|
| 4 | rtk git pull --ff-only | 43.0K | 99.5% | リポジトリ更新（全セッション）|
| 5 | rtk git branch -a | 14.7K | 89.4% | ブランチ一覧 |
| 6 | rtk vitest run | 12.8K | 99.7% | テスト実行（a-bud / a-soil で多用）|
| 7 | rtk curl | 7.5K | 98.3% | API 動作確認 |
| 8 | rtk ls -la | 5.9K | 41.8% | ファイル一覧 |
| 9 | rtk git fetch | 4.8K | 77.1% | リモート取得 |
| 10 | rtk ls -la node_modules | 4.5K | 75.8% | 依存確認 |

→ ガンガン常態モードでの **大量コマンド実行** に対する圧縮効果が大きい。

---

## 5. memory 化候補（記録）

post-デモ（5/14 以降）で memory 化提案:
- 「RTK は global hook で全セッション自動適用」
- 「ガンガン常態モード成立の重要要因 = RTK 64.9% 削減」
- 「新規セッション起動時の確認手順（rtk gain）」

---

## 6. dispatch counter / 後続予定

- a-main-013: main- No. 101 → 次は **102**（counter 更新済、a-main-014 引継ぎ）

---

## 7. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 100（forest B-min Thursday 夜前倒し）| 投下中 |
| **main- No. 101（本書、RTK 横断確認）** | 🟢 投下準備 |
| handoff a-main-013 → a-main-014 | ✅ 完了 |

---

ご確認・各セッションで動作確認お願いします。判断保留事項あれば即停止 → a-main-014 経由で東海林さんに確認依頼。
