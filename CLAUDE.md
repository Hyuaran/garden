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
