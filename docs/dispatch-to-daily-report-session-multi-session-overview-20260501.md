# 作業日報セッションへ - Garden 複数セッション運用 全体像説明 - 2026-05-01

> 起草: a-main-010
> 用途: 作業日報セッションに Garden プロジェクトのセッション体系を共有
> 経由: 東海林さん経由で作業日報セッションにコピペ投下

---

## 投下用短文（東海林さんが作業日報セッションにコピペ）

~~~
【a-main-010 から作業日報セッションへ - Garden プロジェクトのセッション体系説明】

claude.ai → Drive コネクタ連携の本番稼働おめでとうございます。ご活躍の御礼に、
Garden プロジェクト側の複数セッション運用体系をお伝えします。今後のChat→Code連携
を最大限活用するため、ご一読ください。

詳細ファイル: a-main-010/docs/dispatch-to-daily-report-session-multi-session-overview-20260501.md

【要点 8 つ】

1. Garden は 9 モジュール（+ 概念 1）構成、各モジュールに専用 Claude Code セッションあり

2. セッション識別は C:\garden\ 配下のディレクトリで分離
   - a-main / a-main-005 ～ a-main-010 / a-main-N: 横断調整セッション（複数並列）
   - a-soil / a-root / a-tree / a-leaf / a-bud / a-bloom / a-seed / a-forest / a-rill: 各モジュール
   - a-bloom-002 / a-leaf-002 / a-root-002 / a-auto-002 / a-auto-004 等: モジュール並列ワークツリー
   - a-auto: 自律実行専用セッション
   - b-main: 東海林B アカウント（A 使用枠到達時の引き継ぎ先）

3. a-main 系（横断調整セッション）の役割
   - ユーザー対話（東海林さんとの直接やり取り）
   - 全モジュール横断の指示・ルール改訂
   - セッション間の整合性調整
   - 全体方針の伝達
   - 朝の判断・周知配布支援
   - 一番上位の意思決定 / 取りまとめ役

4. モジュールセッション（a-soil / a-root / a-tree 等）の役割
   - 各モジュールの実装作業専任
   - 独自のディレクトリ・ブランチで作業
   - 横断調整を伴う場合は a-main 経由で東海林さんに確認

5. a-auto（自律実行モード専用）の役割
   - ユーザー不在時間帯（就寝・会議・外出中）の自律作業
   - 5 時間使用枠の有効活用
   - 復帰時にレポート + 周知メッセージ + サマリ生成
   - 東海林さんの「自律実行モード発動してください」キーワードで起動
   - a-main / モジュールセッションでは発動しない

6. セッション間のコミュニケーション 3 パターン
   a. dispatch（短文）: 私（a-main）が他セッション向けに起草、東海林さんがコピペで配布
   b. 横断指示メッセージ:「【横断セッション(a-main)からの共有】」で始まるメッセージ
   c. 周知配布（a-auto 経由）: a-auto 完了後、各対象モジュールに to-a-XXX.md 配布

7. 作業日報セッションの位置づけ
   - Garden プロジェクト外（01_東海林美琴 配下、独立した運用）
   - claude.ai → Drive コネクタ経由で Garden プロジェクトとも連携可能
   - state.txt 更新 / UI ドラフト保管が主な責務
   - Garden モジュールセッションへの直接介入は不要、必要時は a-main-010 経由で

8. claude.ai (Web) と作業日報セッションの関係
   - claude.ai は「東海林作業エリア」Project で動作
   - _chat_workspace\ への書き込み 2 箇所のみ許可
   - 詳細は memory project_claude_chat_drive_connector.md 参照

【今後の連携イメージ】

claude.ai (Web) - UI 起草・設計書ドラフト
        ↓ Drive コネクタ
作業日報セッション - state 更新・整理・移送
        ↓ 通知 or 必要時
a-main-010 - 横断調整・モジュール振り分け
        ↓ dispatch
モジュールセッション (a-bloom 等) - 実装

【追加情報が必要な場合】

詳細ファイル a-main-010/docs/dispatch-to-daily-report-session-multi-session-overview-20260501.md
を東海林さん経由で確認してください。質問があれば a-main-010 にリレーお願いします。
~~~

---

## 詳細（参考、作業日報セッションが必要時に参照）

### 1. Garden プロジェクト全体構成

#### 9 モジュール + 概念 1

| モジュール | 和名 | 役割 |
|---|---|---|
| Garden-Soil | 土 | DB本体・大量データ基盤 |
| Garden-Root | 根 | 組織・従業員・パートナー・マスタ |
| Garden-Tree | 木 | 架電アプリ |
| Garden-Leaf | 葉 | 商材×商流ごとの個別アプリ |
| Garden-Bud | 蕾 | 経理・収支 |
| Garden-Bloom | 花 | 案件一覧・日報・KPI・ダッシュボード |
| Garden-Seed | 種 | 新商材・新事業の拡張枠 |
| Garden-Forest | 森 | 全法人の決算資料 |
| Garden-Rill | 川 | チャットワーククローン |
| Garden-Fruit | 実 | 法人法的実体情報モジュール（番号系・許認可・登記簿）|

> 注: 最新の memory では 12 モジュール構成（Sprout / Calendar 追加、Fruit 実体化）に拡張中。

### 2. ディレクトリ配置（Windows）

すべてのセッション用フォルダは `C:\garden\` 配下に集約：

| ディレクトリ | 用途 | 想定ブランチ |
|---|---|---|
| `C:\garden\a-main` | 東海林A メインセッション | 随時 |
| `C:\garden\a-main-005` ～ `a-main-010` | a-main 並列ワークツリー | workspace/a-main-N |
| `C:\garden\a-soil` | Soil モジュール専用 | feature/soil-xxx |
| `C:\garden\a-root` / `a-root-002` | Root モジュール / 並列 | feature/root-xxx |
| `C:\garden\a-tree` | Tree モジュール | feature/tree-xxx |
| `C:\garden\a-leaf` / `a-leaf-002` | Leaf モジュール / 並列 | feature/leaf-xxx |
| `C:\garden\a-bud` | Bud モジュール | feature/bud-xxx |
| `C:\garden\a-bloom` / `a-bloom-002` | Bloom モジュール / 並列 | feature/bloom-xxx |
| `C:\garden\a-seed` | Seed モジュール | feature/seed-xxx |
| `C:\garden\a-forest` | Forest モジュール | feature/forest-xxx |
| `C:\garden\a-rill` | Rill モジュール | feature/rill-xxx |
| `C:\garden\a-auto` / `a-auto-002` / `a-auto-004` | 自律実行モード専用 | feature/xxx-yyy-auto |
| `C:\garden\a-review` | コードレビュー専用 | （随時）|
| `C:\garden\b-main` | 東海林B アカウント | 随時 |

### 3. セッション役割分担

| セッション | 自律実行モード | 役割 |
|---|---|---|
| a-main（横断調整）| 発動しない | ユーザー対話・朝の判断・周知配布支援 |
| a-auto（自律実行専用）| **発動する** | 夜間・会議中の自律作業全般 |
| a-soil/root/tree/leaf/bud/bloom/seed/forest/rill | 発動しない | インタラクティブ作業専用、周知受信役 |
| b-main | 発動しない | 東海林B バックアップ |

### 4. セッション間コミュニケーション 3 パターン

#### パターン A: dispatch（短文）
- a-main が他セッション向けに起草
- ファイル化 + markdown link で東海林さんに提供
- 東海林さんが該当セッションにコピペ

#### パターン B: 横断指示メッセージ
- 「【横断セッション(a-main)からの共有】」で始まる
- 受信セッションは最優先で確認 → アクション
- 疑問点は横断セッション経由で東海林さんに確認

#### パターン C: 周知配布（a-auto 経由）
- a-auto 作業完了後、各対象モジュールに `to-a-XXX.md` 配布
- 受信セッションは 5 ステップ手順で復旧

### 5. 作業日報セッションの位置づけ

#### 既存役割
- 日報自動化（state.txt 更新 → Chatwork 配信）
- claude.ai (Web) との Drive コネクタ連携
- UI ドラフト・設計書ドラフトの一時受け皿

#### Garden プロジェクトとの関係
- Garden モジュールセッションへの **直接介入は不要**
- 必要時は **a-main-010 経由** で連携
- state.txt の表記ルール（半角スペース / 全角コロン）は memory `project_claude_chat_drive_connector.md` §7-B 参照

### 6. claude.ai (Web) との関係

- claude.ai は「**東海林作業エリア**」Project で動作
- claude.ai 書き込み許可場所:
  1. `_chat_workspace\`
  2. `006_日報自動配信\state\state.txt`
- 上記以外への書き込みは禁止
- 詳細は memory `project_claude_chat_drive_connector.md` 参照

### 7. 連携イメージ図

```
┌─────────────────────────────────────────┐
│ claude.ai (Web)                         │
│ - 「東海林作業エリア」Project            │
│ - UI 起草・設計書ドラフト                │
└──────────────┬──────────────────────────┘
               ↓ Drive コネクタ
┌─────────────────────────────────────────┐
│ Google Drive                            │
│ G:\マイドライブ\17_システム構築\         │
│   07_Claude\01_東海林美琴\              │
│   _chat_workspace\                      │
│   006_日報自動配信\state\state.txt      │
└──────────────┬──────────────────────────┘
               ↓ 読み込み・整理
┌─────────────────────────────────────────┐
│ 作業日報セッション (Claude Code)         │
│ - state.txt 上書き適用                  │
│ - UI ドラフト整理移送                    │
│ - Chatwork 配信                         │
└──────────────┬──────────────────────────┘
               ↓ 必要時通知
┌─────────────────────────────────────────┐
│ a-main-010 (横断調整セッション)         │
│ - 全体把握・モジュール振り分け           │
│ - dispatch 起草                         │
└──────────────┬──────────────────────────┘
               ↓ dispatch（東海林さん経由）
┌─────────────────────────────────────────┐
│ Garden モジュールセッション              │
│ a-bloom / a-tree / a-bud / etc.         │
│ - 各モジュール実装                       │
└─────────────────────────────────────────┘
```

### 8. 関連 memory（作業日報セッションが a-main-010 経由で参照可能）

| memory | 内容 |
|---|---|
| `project_claude_chat_drive_connector.md` | claude.ai → Drive コネクタ運用ルール（重要）|
| `project_session_shared_attachments.md` | `_shared\attachments\` 添付一元管理 |
| `feedback_multi_session_worktree_protocol.md` | a-main-N 増設プロトコル |
| `project_garden_3layer_visual_model.md` | Garden 3 レイヤー視覚モデル |

## 改訂履歴

- 2026-05-01 初版（a-main-010、東海林さん依頼で作業日報セッション向け説明文起草）
