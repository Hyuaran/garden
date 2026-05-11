# main- No. 37 dispatch - a-bloom-002 正しい新版ロゴへ差し替え（旧 122KB → 新 480KB）- 2026-05-04

> 起草: a-main-011
> 用途: main- No. 33 で指定した「Drive 公式 122KB 版」が **5/1 旧版**だったため、5/2 新木デザイン版（480KB）に差し替え
> 番号: main- No. 37
> 起草時刻: 2026-05-04(月) 22:04
> 緊急度: 🔴 5/8 デモ向け視覚最終仕上げ
> 背景: 東海林さん「新しいロゴは木が変わってる」明示指摘 → a-main-011 ファイル探索で新版特定

---

## 重要な前提（私の前回指示ミス）

main- No. 33 で「Drive `000_GardenUI/images/logo/garden_logo.png`（122KB）に統一」と指示しましたが、**5/1 旧木デザイン版を指定してしまっていた**。

正しい新版:
- `_chat_workspace/garden-ui-concept/images/logo-garden-series.png`（**480KB / 5/2 14:47**）
- これが東海林さん共有「新しい木デザイン」公式ロゴ

a-bloom-002 報告で「login + spin は HTML path も変更（./images/logo-garden-series.png → ./images/logo/garden_logo.png）」と気づくヒントがあったが、a-main-011 が見落としました。

## 比較

| ファイル | サイズ | 更新 | 状態 |
|---|---|---|---|
| **logo-garden-series.png（正解）**| **480KB**| **5/2 14:47** | 新木デザイン |
| garden_logo.png（5/1 Drive 全 4 箇所）| 122KB | 5/1 21:27 | 旧木デザイン |
| 現 a-bloom-002 worktree | 122KB | 5/4（コピー）| 旧版のまま |

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🔴 main- No. 37
【a-main-011 から a-bloom-002 への dispatch（正しい新版ロゴへ差し替え）】
発信日時: 2026-05-04(月) 22:04

東海林さん明示指摘:「新しいロゴは木が変わってる、これになってるか確認して」

a-main-011 ファイル探索で真因特定:

【真因】

main- No. 33 で a-main-011 が指定した「Drive 公式 122KB 版」は
**5/1 旧木デザイン**でした。新木デザインは別ファイル:

- 正解: `_chat_workspace/garden-ui-concept/images/logo-garden-series.png`
  （480,045 bytes / 5/2 14:47 / 新木デザイン）
- 旧版: `015_Gardenシリーズ/000_GardenUI/images/logo/garden_logo.png`
  （122,419 bytes / 5/1 21:27 / 旧木デザイン）← main- No. 33 で誤って指定

a-bloom-002 報告で「login + spin は HTML path も変更
（./images/logo-garden-series.png → ./images/logo/garden_logo.png）」と
あったが、これは元々新版を参照していた login + spin を **旧版に揃える方向**に
してしまった。

【# 1: 正しい新版ロゴへ差し替え（🔴 必須）】

修正手順:

```bash
# 旧 122KB 版を legacy 保持（既に main- No. 33 で legacy 化済の場合は重ね保持）
cp /c/garden/a-bloom-002/public/images/logo/garden_logo.png \
   /c/garden/a-bloom-002/public/images/logo/garden_logo.legacy-122kb-old-tree-20260504.png

# 新 480KB 版で上書き
cp "/g/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/_chat_workspace/garden-ui-concept/images/logo-garden-series.png" \
   /c/garden/a-bloom-002/public/images/logo/garden_logo.png

# 検証
ls -la /c/garden/a-bloom-002/public/images/logo/garden_logo.png
# 期待: 480,045 bytes
```

## 各 _proto/ 配下の garden_logo.png も同様に差し替え

```bash
SRC="/g/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/_chat_workspace/garden-ui-concept/images/logo-garden-series.png"

for dir in login garden-home-spin garden-home bloom-top ceostatus; do
  TARGET="/c/garden/a-bloom-002/public/_proto/$dir/images/logo/garden_logo.png"
  if [ -f "$TARGET" ]; then
    # 旧 122KB 版を legacy 保持
    cp "$TARGET" "${TARGET%.png}.legacy-122kb-old-tree-20260504.png"
    # 新 480KB 版で上書き
    cp "$SRC" "$TARGET"
  fi
done
```

【# 2: 確認（縦横比チェック）】

新版 480KB の natural サイズ確認:

```bash
# Python or imagemagick で確認、または DOM で確認
# 期待: 横長（3:1 程度）
```

もし縦横比が異なる場合（例: 1:1 正方形）、Topbar の max-height: 60px CSS が
歪んだ画像を作る可能性。新版が公式横長フルロゴなら CSS 既存設定で OK。

【削除禁止ルール継続】

- main- No. 33 で legacy 保持済の `garden_logo.legacy-square-20260504.png` は維持
- 今回の修正で `garden_logo.legacy-122kb-old-tree-20260504.png` 追加保持
- 二重 legacy 保持で履歴維持

【視覚一致検証フロー】

a-main-011 が Chrome MCP で修正後再 DOM 取得:
1. img.src の File-Size: **480,045 bytes**
2. naturalWidth / naturalHeight が新版に応じた値
3. 表示されるロゴが「新しい木デザイン」（東海林さん視覚 OK）

【完了報告フォーマット】

bloom-002- No. 20 で:
- commit hash + push 状態
- 各画面の garden_logo.png サイズ確認（全 6 ファイル: /bloom + 5 _proto）
- legacy 保持ファイル一覧
- 完了時刻

【dispatch counter】

a-main-011: 次 main- No. 38
a-bloom-002: bloom-002- No. 20 で完了報告予定

工数見込み: 15-30 分（cp コマンドのみ、CSS 変更不要）

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 `~~~` 内をコピー |
| 2 | a-bloom-002 に貼り付け投下 |

→ a-bloom-002 が新版に差し替え + push → a-main-011 が Chrome MCP で再検証 → 視覚一致達成 → 5/8 デモ準備完了。

## a-main-011 教訓

memory `feedback_check_existing_impl_before_discussion.md` 厳守: 最新ファイルを確認せず古いファイルを「公式版」と指定してしまった。次回ファイル探索時は **更新日時順 + ヒントメッセージ精読** で最新を特定。

## 改訂履歴

- 2026-05-04 22:04 初版（a-main-011、東海林さん「木が変わってる」指摘 → ファイル探索で 5/2 新版特定 → 起草）
