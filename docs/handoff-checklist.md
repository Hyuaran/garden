# a-main セッション引越し時 handoff チェックリスト

> memory `feedback_session_handoff_checklist` 準拠
> 引越し起草前に上から順に必ず実施

---

## §0 引越しトリガー判定

| 帯 | アクション |
|---|---|
| context 50-60% | a-main 標準引越しタイミング、本チェックリスト発動 |
| 60-70% | 即引越し実行 |
| 70-80% | 緊急引越し |
| 80%+ | 強制終了帯 |

memory `feedback_main_session_50_60_handoff` 準拠。

---

## §1 git 実態確認

```bash
pwd
git status
git branch --show-current
git log --oneline -10
git log origin/develop..HEAD --oneline | head -30  # 未 push commit
```

→ handoff §2 に貼付。

---

## §2 dispatch counter + 直近 dispatch 確認

```bash
cat docs/dispatch-counter.txt
ls -lt docs/dispatch-main-no*.md | head -10
```

→ handoff §3 に貼付。

---

## §3 各モジュール稼働状況確認

```bash
for d in a-bloom a-bud a-soil a-leaf a-root a-tree a-forest a-rill a-auto a-review; do
  echo "=== $d ==="
  if [ -d "C:/garden/$d" ]; then
    cd "C:/garden/$d"
    git log -3 --oneline 2>/dev/null
    git log -1 --format="last: %cr (%cd)" --date=iso 2>/dev/null
  fi
done
```

→ 30 分以上停滞しているセッションを検出 → handoff §4 + 引越し前に別タスク投下判断。

memory `feedback_module_round_robin_check` 準拠。

---

## §4 memory 棚卸し + 矛盾検証

### 4-1. MEMORY.md 索引と実ファイル整合確認

```bash
# 索引にあるが実ファイルが無いもの検出
grep -oP '\[.*?\]\(\K[^)]+' "C:/Users/shoji/.claude/projects/C--garden-a-main/memory/MEMORY.md" | while read f; do
  [ ! -f "C:/Users/shoji/.claude/projects/C--garden-a-main/memory/$f" ] && echo "MISSING: $f"
done

# 実ファイルがあるが索引に無いもの検出
ls "C:/Users/shoji/.claude/projects/C--garden-a-main/memory/" | grep '\.md$' | grep -v MEMORY | while read f; do
  grep -q "($f)" "C:/Users/shoji/.claude/projects/C--garden-a-main/memory/MEMORY.md" || echo "NOT INDEXED: $f"
done
```

### 4-2. 直近 7 日に追加された memory の整合性検証

```bash
find "C:/Users/shoji/.claude/projects/C--garden-a-main/memory/" -name "*.md" -mtime -7 | head -20
```

→ 各 memory の **トリガー条件 / 適用範囲 / 例外** が明示されているか
→ 既存 memory との矛盾がないか
→ memory 強化提案を handoff §8 に記載

### 4-3. 「機能していなかった memory」の特定

セッション内 違反 / 忘れ事項（§5）と既存 memory の対応関係を確認:
- 違反したのに memory が存在 → memory が機能していなかった = 強化要
- 違反したが memory なし → 新設候補

---

## §5 セッション内 違反 / 忘れ事項 集計

### 5-1. 自己評価ラウンド（私が記述）

| # | 時刻 | 違反 / 忘れ | 該当 memory | 影響 |
|---|---|---|---|---|
| 1 | HH:MM | ... | feedback_xxx | ... |

### 5-2. 東海林さん追記欄（必ず依頼）

```
> 東海林さん、§5 に他の違反 / 忘れがあれば追記お願いします。
> 自己評価のみだと甘くなる傾向があるため、客観視点が必要です。
```

memory `feedback_my_weak_areas`「自己評価の甘さ」原則。

---

## §6 厳しい目で再確認 N ラウンド（焦点別）

memory `feedback_strict_recheck_iteration` 準拠。

### ラウンド焦点表

| ラウンド | 焦点 |
|---|---|
| 1 | 対処済か |
| 2 | 対処の質（トリガー / 具体手順 / 例外）|
| 3 | メタレベル抜け（自己評価甘さ / 仕組みの抜け / 既存実装把握漏れ / 不得意分野自覚漏れ）|
| 4 | 実装漏れ（実際に動くか / テンプレ落とし込み / 日常呼び出し可能か）|
| 5 | 矛盾検出（既存ルール矛盾 / 二重管理 / 状態認識）|
| 6+ | 必要なら継続、新しい角度 |

### 終了条件

**連続 3 ラウンドで抜け 0 件** + **盲点リスト自己宣言** + **東海林さん最終チェック必須**。

### 東海林さん最終チェック依頼時のルール（必須）

- 専門用語禁止（sentinel / trigger / metadata 等の英単語使わない）
- 同じ説明を繰り返してでも初見の人がわかる表現
- 「ここの抜けがないか見てください」と焦点絞る
- 私の盲点リスト併記
- 専門用語必須時は即座に意味併記

### 各ラウンド記録欄

#### ラウンド 1: 対処済か
- 抜け N 件
- 発見項目: ...

#### ラウンド 2: 対処の質
- 抜け M 件
- 発見項目: ...

#### ラウンド 3: メタレベル
- 抜け K 件
- 発見項目: ...

#### ラウンド 4: 実装漏れ
- 抜け L 件
- 発見項目: ...

#### ラウンド 5: 矛盾検出
- 抜け P 件
- 発見項目: ...

#### ラウンド 6+: 必要なら継続
- 焦点: ...
- 抜け Q 件

---

## §7 三点セット同期テキスト発行

memory `feedback_three_way_sync_cc_claudeai_procedure` 準拠。

### ブロック 1: Claude Code memory（既に Write 済）

ファイル: ...
変更点: ...

### ブロック 2: claude.ai「Claudeへの指示」追記用（東海林さんが貼付）

```
~~~
[追記する自然文、1-3 行]
~~~
```

### ブロック 3: claude.ai プロジェクト「手順」追記用（東海林さんが貼付）

```
~~~
[手順内の該当セクションへの追記、1-3 行]
~~~
```

---

## §8 RTK gain 報告

```bash
rtk gain
```

→ 累計トークン削減 / Tokens saved を handoff §11 に記録。

---

## §9 a-main-(N+1) worktree 先行作成

```powershell
cd C:\garden
git worktree add C:\garden\a-main-018 -b workspace/a-main-018
```

handoff 起草開始前に worktree 作成 → 起草完了後すぐ起動可能に。

---

## §10 handoff 起草完了後の最終確認（東海林さん向け、必須）

**東海林さん最終チェックは構造的必須**（私の自己判定だけでは漏れる、5/9 19:30 確定）。

説明ルール（最重要）:
- 専門用語禁止
- 同じ説明を繰り返してでも初見でわかる表現
- 何を見てほしいか焦点絞る

| 確認 | 質問（東海林さんへの問いかけ例）|
|---|---|
| § 5 違反 / 忘れ事項追加 | 「私が気付いていない違反 / 忘れがあれば教えてください。1 件でも追加歓迎」 |
| § 4 memory 強化判断 | 「memory X を強化したいです、こういう中身です（要約）→ GO ですか？」 |
| § 6 ラウンド点検結果 | 「N ラウンドで抜け 0 件続きました。最終確認お願いします、抜けあれば追加します」 |
| § 7 三点セット貼付 | 「claude.ai のここに貼付お願いします（具体場所明示）」 |
| 起動指示 | 「a-main-(N+1) を新 PowerShell で起動してください」 |

---

## 改訂履歴

- 2026-05-09 18:30 初版（a-main-017、016 期教訓統合）
