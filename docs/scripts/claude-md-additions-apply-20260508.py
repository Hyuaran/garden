"""
CLAUDE.md §20-23 一括反映スクリプト - 2026-05-08
- 親 Garden + 各子セッション + 個人 の CLAUDE.md に §20-23 追加
- 既存 §19 の後ろに挿入
- 個人 CLAUDE.md には §20 + §21 + §23 のみ（§22 main 引っ越しは Garden 親で重複可避け）
"""

import sys
import io
import shutil
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# §20-23 完全版（Garden 親 + 各 Garden 子 + ローカルセッション CLAUDE.md 用）
SECTIONS_FULL = """

---

## 20. Claude 使用環境 + ChatGPT 連携（2026-05-08 追加）

### 20-1. 使用ツール

| ツール | 形態 | 用途 | 主体 |
|---|---|---|---|
| **Claude Code** | デスクトップアプリ版 | Garden 開発・dispatch 起草・コードレビュー（メイン）| Claude |
| **Claude.ai** | WEB ページ（Chrome 等で常時開いている）| HTML/UI 作成（テキスト/CSS 生成）+ ChatGPT 投下用テキスト発行 | Claude |
| **ChatGPT** | WEB ページ | **画像生成・実画面作成** | 東海林さん + ChatGPT |

### 20-2. 役割分担（重要）

| 担当 | 役割 |
|---|---|
| Claude.ai | HTML / CSS / JS の生成、ChatGPT 投下用テキスト起草 |
| 東海林さん + ChatGPT | 実際の画面作成（画像生成）|
| Claude.ai（再度）| ChatGPT 生成画像をもとに HTML / CSS 起草 |

### 20-3. ChatGPT 投下時のルール（**絶対遵守**）

Claude.ai が ChatGPT 投下用テキストを生成する際、**添付データ（画像 / ファイル等）が必要な場合**は、必ず **コピーテキスト外** で東海林さんへ分かりやすく指示する:

#### NG パターン
```
（コピーテキスト内に「画像を添付してください」と書く）
```

#### OK パターン
```
【ChatGPT に投下するテキスト】
（コピーテキスト本文）

---

【東海林さんへ - コピーテキスト外】
このテキストを ChatGPT に投下する際、以下のファイルを添付してください:
- xxx.png（〇〇の参考画像）
- yyy.html（既存 UI 構造）
```

### 20-4. 連携運用

- Claude Code = ファイル / git / コード操作主体（CLI 系作業）
- Claude.ai = HTML/UI 起草 + ChatGPT 投下テキスト発行
- ChatGPT = 画像生成・実画面作成
- `_chat_workspace/` 配下で markdown / HTML 経由で相互参照

---

## 21. 通常モード（旧称: ガンガン常態モード）= デフォルト（2026-05-08 追加）

### 21-1. 通常モードの定義

**通常モード = デフォルト動作**:
- 議論せず即実行（auto フル使用 / 並列化 / 東海林さん作業最小化）
- モジュールが「停止 / 慎重」案推奨でも、東海林さんスタンスに合わせて訂正
- 真に進めれない事情（依存 / 設計判断 / バグリスク）のみ停止 OK
- それ以外は自走判断で進む

### 21-2. 解除タイミング

通常モードの解除は **東海林さん明示の声かけ時のみ**:

| 東海林さんの声かけ | モード切替 |
|---|---|
| 「慎重モードに切替」「立ち止まって」「議論してから」| 慎重モード（議論ベース）|
| 「通常に戻して」「再開」「ガンガンで」| 通常モード（デフォルト）|
| （声かけなし）| 通常モード継続 |

### 21-3. ルール簡素化の意義

- 「ガンガン常態モード」という別概念を導入せず、**通常モード = デフォルト**として 1 つに集約
- ルール重複による判断鈍化・誤判断を防止
- メモリー / dispatch / handoff での「ガンガン」表現は徐々に「通常モード」に統一（後追い）

---

## 22. コンテキスト超過アラート + セッション引っ越し（2026-05-08 追加）

### 22-1. アラート発動 + 引っ越し基準（3 段階）

| 区分 | 50% 到達 | 60% 到達 | 70% 到達 | 80% 到達（既存ルール）|
|---|---|---|---|---|
| **a-main 系統** | **アラート 1 回目 + 引っ越し準備** | **アラート 2 回目 + 引っ越し実行（§22-4）** | アラート 3 回目 + 即実行（必須）| 完全ハンドオフメモ書き出し + push（最終）|
| **モジュールセッション** | （特になし）| **アラート 1 回目 + 引っ越し準備** | **アラート 2 回目 + 引っ越し実行** | 完全ハンドオフメモ書き出し + push（最終）|

→ **main は早め（50-60%）、モジュールは中速（60-70%）、80% は全セッション最終ライン**。

### 22-2. 区分別の理由

- **a-main 系統 50-60% で引っ越し**: 横断調整 + メモリー判断の責務が重いため、早めの引っ越しで品質維持
- **モジュールセッション 60-70% で引っ越し**: 実装作業の中断を避けつつ、80% 強制終了前に余裕を持って引っ越し
- **80% 最終ライン**: 既存 CLAUDE.md ルール踏襲、強制終了直前のバックアップ用

### 22-3. main / モジュール共通の引っ越し原則

- 引っ越しタイミングが来たら、各セッションは **handoff メモ書き出し → 新セッション起動 → コピペ短文受領** の流れ
- main 系統は **メモリー重複チェック + クリーンアップ判断**（§23 参照）も必須

### 22-4. 引っ越し手順（Claude Code が実施、main / モジュール 同手順）

| Step | 作業 | 主体 |
|---|---|---|
| 1 | 新セッション用 worktree フォルダ作成 | **Claude Code（自動）** |
| 2 | ハンドオフメモ起草（`docs/handoff-[旧→新]-YYYYMMDD.md`）| Claude Code |
| 3 | **メモリー重複チェック + クリーンアップ判断**（§23 参照、a-main のみ必須）| Claude Code（main のみ）|
| 4 | dispatch counter 最新化 + handoff 記載 | Claude Code |
| 5 | 待機中ジョブ一覧 + 判断保留事項一覧化 | Claude Code |
| 6 | 次セッションへの **引き継ぎコピペテキスト** 発行 | Claude Code |
| 7 | git commit + push | Claude Code |
| 8 | 東海林さんが新セッション起動 + コピペテキスト 1 回投下 | 東海林さん |

### 22-5. 引き継ぎコピペテキストの形式

```
[新セッション名] として作業を引き継いでください。

以下を順番に実施:
1. pwd で C:\\garden\\[新セッションパス] 確認
2. git status で workspace/[新ブランチ] ブランチ確認
3. git pull origin workspace/[旧ブランチ] で最新取得（handoff 含む）
4. docs/handoff-[旧→新]-YYYYMMDD.md を精読
5. dispatch counter [N] 確認
6. 累計成果と現在進行中タスクの把握
7. 待機中ジョブ確認
8. ★最初のタスク: [具体的タスク or なし]
9. 完了したら「[新セッション名] 起動完了。通常モード継続」と返答

注意点:
- 通常モード継続（解除指示なければデフォルト）
- ...
```

### 22-6. ハンドオフメモのテンプレート（既存ルール踏襲）

- 既存 §「ハンドオフメモのテンプレート」参照
- §22-4 Step 3「メモリー重複チェック + クリーンアップ判断」は **a-main のみ必須**（モジュールは任意）

### 22-7. RTK 削減集計 報告（必須、全セッション共通）

引っ越し時、各セッションは `rtk gain` 実行結果を **必ず** main に報告:

#### 報告内容

| 項目 | 値 |
|---|---|
| Total commands | N |
| Input tokens | XX.XK |
| Output tokens | XX.XK |
| Tokens saved | XXX.XK (XX.X%) |
| Total exec time | XXXmXXs |

#### 報告タイミング

- **a-main 系統**: 50% アラート時 + 引っ越し実行時 = 計 2 回（前後比較で削減量算出）
- **モジュールセッション**: 60% アラート時 + 引っ越し実行時 = 計 2 回
- → 1 セッションあたり 2 回報告で **そのセッション期間中の削減量** が見える

#### 報告経路

- モジュールセッション → main へ dispatch（`<session>-N` 形式、`rtk gain` 結果含む）
- main → 自セッション内で実行 + 累計集計ファイル（`docs/rtk-cumulative-tracking.md`）に追記

#### 東海林さんへの報告（main 引っ越し時 必須）

- main は累計トラッキングファイルから期間別サマリ + セッション別貢献度を算出
- 東海林さんへ報告（main 引っ越し時必須、月次でも実施可）
- フォーマットは `docs/rtk-cumulative-tracking.md` §5 参照

---

## 23. メモリー main 判断ルール（2026-05-08 追加）

### 23-1. メモリーの所在と権限

| 種別 | 所在 | 読込権限 | 更新権限 |
|---|---|---|---|
| user memory（feedback / project / user）| `~/.claude/projects/C--garden-a-main/memory/` | 全セッション | **a-main のみ** |
| MEMORY.md（index）| 同上 | 全セッション | **a-main のみ** |

### 23-2. 各セッションの責務

- **モジュールセッション（a-bud / a-soil / a-tree 等）**:
  - メモリーは **参照のみ**（読込 OK、書込 NG）
  - 学んだこと / 改善提案は **dispatch で main に上げる**
  - 例: 「TDD で structural 変更回避できた」→ tree-N で main 経由
- **a-main セッション**:
  - 各モジュールから上がった提案を東海林さんと議論
  - 採用判断 → memory ファイル更新
  - 引っ越し時にメモリー重複チェック + クリーンアップ

### 23-3. メモリー更新フロー

```
モジュールセッション（学び・提案）
   ↓ dispatch
a-main（受領 + 評価）
   ↓ 東海林さん判断仰ぎ（採用 / 却下 / 保留）
a-main（採用 → memory ファイル更新 / index 追記）
```

### 23-4. main 引っ越し時のメモリー判断（§22-4 Step 3）

a-main 引っ越し時、新 main は引き継ぎ前に以下を実施:

| 項目 | 確認 |
|---|---|
| 重複ルール | 同様のルールが複数 memory ファイルに分散していないか |
| 矛盾ルール | 矛盾するルールが共存していないか |
| 古いルール | 過去に有効だったが現在は廃止されたルールが残っていないか |
| 統合候補 | 関連する小さなルールを統合可能か |
| 東海林さんの時間を無駄にしているか | 各セッションが memory 読込で時間を消費していないか |

→ 東海林さんと議論後、必要なら memory consolidation skill で統合・整理。

### 23-5. 各セッションが memory を読込する場合

- 起動時の必要最小限のみ（最重要セクション 9 件）
- 必要時に個別 memory を Skill 等で読み込み（§19 ルール C-2 準拠）
- 不要な全件精読は禁止

### 23-6. メモリー安全性の維持

main は引っ越し時 + 必要時に以下を確認:
- 全体メモリーと各セッションメモリーが安全で安心
- 東海林さんの時間を無駄にしない作りになっているか
- 重複・矛盾の早期発見・解消

→ メモリー品質保証は a-main の責務、モジュールセッションは負担しない。
"""

# 個人 CLAUDE.md 用（§20 + §21 + §23 のみ、§22 main 引っ越しは Garden 親で重複可避け）
SECTIONS_PERSONAL = """

---

## 20. Claude 使用環境 + ChatGPT 連携（2026-05-08 追加）

### 20-1. 使用ツール

| ツール | 形態 | 用途 | 主体 |
|---|---|---|---|
| **Claude Code** | デスクトップアプリ版 | Garden 開発・dispatch 起草・コードレビュー（メイン）| Claude |
| **Claude.ai** | WEB ページ（Chrome 等で常時開いている）| HTML/UI 作成（テキスト/CSS 生成）+ ChatGPT 投下用テキスト発行 | Claude |
| **ChatGPT** | WEB ページ | **画像生成・実画面作成** | 東海林さん + ChatGPT |

### 20-2. 役割分担（重要）

| 担当 | 役割 |
|---|---|
| Claude.ai | HTML / CSS / JS の生成、ChatGPT 投下用テキスト起草 |
| 東海林さん + ChatGPT | 実際の画面作成（画像生成）|
| Claude.ai（再度）| ChatGPT 生成画像をもとに HTML / CSS 起草 |

### 20-3. ChatGPT 投下時のルール（**絶対遵守**）

Claude.ai が ChatGPT 投下用テキストを生成する際、**添付データ（画像 / ファイル等）が必要な場合**は、必ず **コピーテキスト外** で東海林さんへ分かりやすく指示する:

#### OK パターン例
```
【ChatGPT に投下するテキスト】
（コピーテキスト本文）

---

【東海林さんへ - コピーテキスト外】
このテキストを ChatGPT に投下する際、以下のファイルを添付してください:
- xxx.png（〇〇の参考画像）
```

---

## 21. 通常モード（旧称: ガンガン常態モード）= デフォルト（2026-05-08 追加）

通常モード = デフォルト動作:
- 議論せず即実行（auto フル使用 / 並列化 / 東海林さん作業最小化）
- 真に進めれない事情のみ停止 OK
- それ以外は自走判断で進む

解除は **東海林さん明示の声かけ時のみ**（「慎重モード」「立ち止まって」等）。

---

## 23. メモリー main 判断ルール（2026-05-08 追加）

### 23-1. メモリーの所在と権限

| 種別 | 所在 | 読込権限 | 更新権限 |
|---|---|---|---|
| user memory（feedback / project / user）| `~/.claude/projects/C--garden-a-main/memory/` | 全セッション | **a-main のみ** |

### 23-2. 各セッションの責務

- モジュールセッション: メモリー参照のみ、学び・改善提案は dispatch で main に上げる
- a-main: 採用判断 → memory ファイル更新、引っ越し時にメモリー重複チェック + クリーンアップ

### 23-3. メモリー更新フロー

```
モジュールセッション（学び・提案）→ dispatch → a-main（評価）→ 東海林さん判断 → a-main が memory 更新
```

### 23-4. 各セッションの memory 読込

- 起動時の必要最小限のみ（最重要セクション 9 件）
- 全件精読は禁止
"""


def append_to_claude_md(path: Path, content: str, dry_run: bool = False) -> dict:
    """CLAUDE.md の末尾に §20-23 を追加（既に追加されている場合はスキップ）"""
    if not path.exists():
        return {"path": str(path), "status": "not_found"}

    try:
        with open(path, "r", encoding="utf-8") as f:
            existing = f.read()
    except Exception as e:
        return {"path": str(path), "status": "read_error", "error": str(e)}

    # 重複チェック: 「## 20. Claude 使用環境」が既に含まれていればスキップ
    marker = "## 20. Claude 使用環境"
    if marker in existing:
        return {"path": str(path), "status": "already_added"}

    if dry_run:
        return {"path": str(path), "status": "dry_run", "size_before": len(existing), "size_after": len(existing) + len(content)}

    # backup
    backup_path = path.with_suffix(".md.bak-claude-md-20-23-20260508")
    try:
        shutil.copy2(path, backup_path)
    except Exception as e:
        return {"path": str(path), "status": "backup_error", "error": str(e)}

    # append
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(content)
    except Exception as e:
        return {"path": str(path), "status": "write_error", "error": str(e)}

    return {"path": str(path), "status": "updated", "size_after": len(existing) + len(content)}


def main():
    dry_run = "--dry-run" in sys.argv

    # 対象パス収集
    targets_full = []  # §20-23 全部追加
    targets_personal = []  # §20 + §21 + §23 のみ追加

    # 1. 親 Garden CLAUDE.md
    parent_garden = Path("G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ/CLAUDE.md")
    if parent_garden.exists():
        targets_full.append(parent_garden)

    # 2. Drive Garden 子 CLAUDE.md（11 件、各モジュール配下）
    drive_garden_dir = Path("G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/015_Gardenシリーズ")
    for child in drive_garden_dir.glob("*/CLAUDE.md"):
        targets_full.append(child)

    # 3. ローカル Garden 各セッション CLAUDE.md
    local_garden_dir = Path("C:/garden")
    for child in local_garden_dir.glob("*/CLAUDE.md"):
        # backup ディレクトリは除外
        if "_backup" in str(child):
            continue
        targets_full.append(child)

    # 4. 個人 CLAUDE.md
    personal = Path("G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/CLAUDE.md")
    if personal.exists():
        targets_personal.append(personal)

    # 重複除去
    targets_full = list(set(targets_full))
    targets_full.sort(key=lambda p: str(p))

    print(f"# CLAUDE.md §20-23 一括反映{'（dry-run）' if dry_run else ''}")
    print(f"対象 (full): {len(targets_full)} 件")
    print(f"対象 (personal): {len(targets_personal)} 件")
    print()

    print("## Full 対象（§20-23 全部）")
    results_full = []
    for target in targets_full:
        result = append_to_claude_md(target, SECTIONS_FULL, dry_run=dry_run)
        results_full.append(result)
        icon = "✅" if result["status"] in ("updated", "dry_run") else ("➖" if result["status"] == "already_added" else "❌")
        print(f"{icon} {result['path']}: {result['status']}")

    print()
    print("## Personal 対象（§20 + §21 + §23 のみ）")
    results_personal = []
    for target in targets_personal:
        result = append_to_claude_md(target, SECTIONS_PERSONAL, dry_run=dry_run)
        results_personal.append(result)
        icon = "✅" if result["status"] in ("updated", "dry_run") else ("➖" if result["status"] == "already_added" else "❌")
        print(f"{icon} {result['path']}: {result['status']}")

    print()
    print("## サマリ")
    all_results = results_full + results_personal
    updated = sum(1 for r in all_results if r["status"] in ("updated", "dry_run"))
    already_added = sum(1 for r in all_results if r["status"] == "already_added")
    errors = sum(1 for r in all_results if r["status"] in ("read_error", "write_error", "not_found", "backup_error"))

    print(f"- 更新: {updated}")
    print(f"- 既反映: {already_added}")
    print(f"- エラー: {errors}")


if __name__ == "__main__":
    main()
