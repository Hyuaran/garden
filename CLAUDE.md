# CLAUDE.md — Gardenシリーズ

> このファイルはClaude Codeが自動で読み込む、プロジェクト共通の指示書です。
> **メンバーはこのファイルを編集しないでください。変更が必要な場合は槙に相談。**

@AGENTS.md

---

## プロジェクト概要

- **Gardenシリーズ**: FileMaker・kintoneの代替となる自社Webアプリケーション
- **技術スタック**: Next.js (App Router) / Supabase / Vercel / TypeScript / Tailwind CSS

## モジュール構成（9モジュール＋概念1）

| モジュール | 和名 | パス | 役割 |
|---|---|---|---|
| Soil | 土 | `src/app/soil/` | DB本体・大量データ基盤（リスト、コール履歴、関電リスト） |
| Root | 根 | `src/app/root/` | 組織・従業員・パートナー・マスタデータ・条件 |
| Tree | 木 | `src/app/tree/` | 架電アプリ |
| Leaf | 葉 | `src/app/leaf/` | 商材×商流ごとの個別アプリ（約30テーブル）・トスアップ |
| Bud | 蕾 | `src/app/bud/` | 経理・収支（明細・振込・損益・給与） |
| Bloom | 花 | `src/app/bloom/` | 案件一覧・日報・KPI・ダッシュボード |
| Seed | 種 | `src/app/seed/` | 新商材・新事業の拡張枠 |
| Forest | 森 | `src/app/forest/` | 全法人の決算資料等 |
| Rill | 川 | `src/app/rill/` | チャットワークAPIを利用したメッセージアプリ |
| Fruit | 実 | — | 概念のみ（アプリなし） |

## データ設計の基本方針

- 商材×商流ごとに独立テーブル
- 案件一覧VIEWで横断参照
- 営業リスト＋コール履歴はSoilに格納
- 案件化された顧客のみLeafに移行

## ブランチ運用ルール

- `main`: 本番用。直接pushしない。Pull Requestでのみ変更
- `develop`: 開発の共有場所。直接pushしない。Pull Requestでのみ変更
- `feature/xxxxx`: 各メンバーの作業用。developから作成すること

## コミットメッセージ規則

```
種類(モジュール名): 変更内容の要約
```

種類: feat / fix / style / refactor / docs

例:
- `feat(root): 従業員テーブルのCRUD画面を追加`
- `fix(leaf): 案件一覧の検索が動かないバグを修正`

## 開発ルール

- 新しいnpmパッケージを追加する場合は事前に相談する
- Supabase本番（garden-prod）のデータを直接操作しない
- garden-devのテーブル構造を変更する場合は事前に相談する
- `.env.local` はGitHubにアップロードしない（.gitignoreで除外済み）

## 環境変数

ローカル開発には `.env.local` に以下を設定:

```
NEXT_PUBLIC_SUPABASE_URL=（garden-devのURL）
NEXT_PUBLIC_SUPABASE_ANON_KEY=（garden-devのPublishable key）
SUPABASE_SERVICE_ROLE_KEY=（garden-devのSecret key）
```

## 複数セッション運用ルール

Claude Code を複数セッション並行で動かす場合、**必ずセッションごとに独立したディレクトリで作業すること**。同じディレクトリを複数セッションで使うと、ブランチが勝手に切り替わる問題が発生する。

### ディレクトリ配置（Windows）

全てのセッション用フォルダは `C:\garden\` 配下に集約する。

| ディレクトリ | 用途 | 想定ブランチ |
|---|---|---|
| `C:\garden\a-main` | 東海林A メインセッション | 随時 |
| `C:\garden\a-soil` | 東海林A Soil モジュール専用 | feature/soil-xxx |
| `C:\garden\a-root` | 東海林A Root モジュール専用 | feature/root-xxx |
| `C:\garden\a-tree` | 東海林A Tree モジュール専用 | feature/tree-xxx |
| `C:\garden\a-leaf` | 東海林A Leaf モジュール専用 | feature/leaf-xxx |
| `C:\garden\a-bud` | 東海林A Bud モジュール専用 | feature/bud-xxx |
| `C:\garden\a-bloom` | 東海林A Bloom モジュール専用 | feature/bloom-xxx |
| `C:\garden\a-seed` | 東海林A Seed モジュール専用 | feature/seed-xxx |
| `C:\garden\a-forest` | 東海林A Forest モジュール専用 | feature/forest-xxx |
| `C:\garden\a-rill` | 東海林A Rill モジュール専用 | feature/rill-xxx |
| `C:\garden\b-main` | 東海林B（shoji@centerrise.co.jp） | 随時 |

### セッション開始時の必須確認

各セッションは起動直後に以下を実行し、自分の居場所・ブランチ・状態を把握すること：

```bash
pwd
git status
git branch --show-current
```

もし想定と異なるディレクトリ・ブランチにいる場合、**作業を開始せず**、ユーザーに状況を報告すること。

### 禁止事項

- 自分の担当ディレクトリ以外での `git checkout`
- 自分の担当ディレクトリ以外でのファイル編集
- 複数セッションで同じブランチを同時チェックアウト（push衝突の原因）

## Claude Code 使用率アラートルール

Claude Code には複数の制限があり、**最も厳しい（使用率が高い）制限に合わせて行動**すること：

1. **5時間制限（短期）**: セッションごとにリフレッシュされる短期利用上限
2. **週次制限（長期）**: 週単位で累積する長期利用上限
3. **全モデル合算 / モデル別**: Opus / Sonnet / Haiku それぞれの利用状況

AIは作業の節目（ファイル編集完了後、重い処理の後など）で `/cost` `/context` などで使用状況を確認し、以下のアクションを取ること。

### 使用率別アクション

#### 70% 到達時（注意ライン）
- ユーザーに以下を提案：
  > 「Claude Codeの使用率が70%に達しました。そろそろ切替準備を始めますか？（はい／まだ大丈夫）」
- `docs/wip-YYYYMMDD.md` に現在の進捗を3行程度で記録

#### 80% 到達時（警戒ライン）★最重要
- **完全なハンドオフメモを書き出す**：`docs/handoff-YYYYMMDD.md` に以下を記載
  - 今やっていること（1〜3行）
  - 次にやるべきこと（1〜3行）
  - 注意点・詰まっている点
  - 関連ファイル・ブランチ名
  - 担当セッション名（例：a-forest / a-tree）
- 変更を commit して GitHub に push
- ユーザーに以下を確認：
  > 「ハンドオフを書き出してpushしました。このまま続行しますか？／別セッションに切替しますか？」

#### 85〜90% 到達時（切替推奨）
- **新規作業は開始しない**
- 進行中の作業を区切りのよい箇所で停止
- ユーザーに**切替シナリオ**を自動提示：
  > 「使用率85%超えました。別セッションへの切替をおすすめします。以下のシナリオで進めますか？
  > 
  > 【切替シナリオ】
  > 1. 別のPowerShellで `cd C:\garden\a-xxx`
  > 2. `git fetch --all`
  > 3. `git checkout feature/xxx`
  > 4. `git pull`
  > 5. `claude` でClaude Code起動
  > 6. 起動後に「docs/handoff-YYYYMMDD.md を読んで続きを進めて」と依頼」
- ユーザーの判断を待つ：「シナリオで進める／まだ続ける」

#### 95% 以上到達時（強制終了ライン）
- このセッションは終了扱い
- 新規の応答は最小限にする
- 既存の作業まとめのみ行う

### アラートのトリガーは「最も高い使用率」

- 5時間制限が 60%、週次制限が 82% なら → **82% を採用 → 80%アクション発動**
- モデル別で Opus が 90% なら → **90% を採用 → 85%アクション発動**

### ハンドオフメモのテンプレート

```markdown
# Handoff - YYYY-MM-DD (担当セッション名)

## 今やっていること
- （作業内容を1〜3行）

## 次にやるべきこと
- （TODO を箇条書き）

## 注意点・詰まっている点
- （落とし穴、進行中の調査など）

## 関連情報
- ブランチ: feature/xxx
- 関連ファイル: src/app/xxx/yyy.tsx など
- 関連PR/Issue: #XXX
```
