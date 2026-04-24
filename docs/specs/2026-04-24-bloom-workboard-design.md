# Garden-Bloom（花）— 案件一覧・日報・KPI・ダッシュボード・**Workboard（作業可視化）**

> **親ルール**: `../CLAUDE.md`（Gardenシリーズ共通）

## モジュール役割

社内向け「見える化」モジュール。**日報・KPI・営業損益・作業可視化**を統合。

| モジュール | 役割 |
|:--|:--|
| Garden-Bud（蕾） | 経理「処理」 |
| **Garden-Bloom（花）** | **社内向け「見える化」**: 日報、KPI、営業損益、**Workboard** |
| Garden-Forest（森） | 決算・会計 |

## ステータス

**構築中**（2026-04-24〜）— Phase A-1 で **Workboard を先行実装**。

## 主要責務

1. **Workboard（作業可視化）** ← Phase A-1 で最優先実装
2. ロードマップダッシュボード
3. 日報・自動配信連携（既存 `send_report.py` と統合）
4. KPI集計・可視化
5. 営業損益（社内用）
6. 案件一覧（横断ビュー）

## 🆕 Workboard 機能設計（2026-04-24 追加）

### 目的

1. **「東海林が何してるか不明」「手を抜いているのでは？」問題の解決**
2. **毎月15-20日の責任者会議で使う月次ダイジェスト提供**
3. **Claude課金の会社負担コストの正当化**（経費指摘への回答）
4. 他スタッフ・管理者による修正依頼タイミング判断

### 機能構成

```
/bloom
  ├── /workboard          ← 個人の作業可視化
  │    ├── 現在のステータス（対応可能/取り込み中/集中業務中/外出中）
  │    ├── 本日の予定（3-5項目）
  │    ├── 進行中プロジェクト
  │    ├── 今週の実績
  │    └── 次のマイルストーン
  ├── /roadmap            ← Garden全体ロードマップ
  │    ├── 全体進捗バー
  │    ├── タイムライン（M1-M8）
  │    ├── モジュール別進捗
  │    ├── リスクカード
  │    ├── お知らせバナー（遅延・変更アラート）
  │    └── 表示切替：👥みんな向け / ⚙️開発向け
  ├── /monthly-digest     ← 月次会議用レポート（大画面投影モード）
  │    ├── 今月の主要達成
  │    ├── 全体進捗グラフ
  │    ├── 来月の目標
  │    ├── 稼働サマリ
  │    └── PDF・画像エクスポート
  └── /daily-reports      ← 日報統合（既存 send_report.py）
```

### ステータス名称（確定）

**autoモードの存在を隠蔽した、一般的な業務用語**：

| アイコン | 名称 | 意味 |
|---|---|---|
| 🟢 | **対応可能** | 質問・依頼OK |
| 🟡 | **取り込み中** | 電話なら対応可、メッセージは後回し |
| 🔴 | **集中業務中** | 緊急以外は避けて |
| ⚪ | **外出中** | 翌日以降対応 |

### 権限設計

| ロール | 見える情報 |
|---|---|
| super_admin（東海林さん） | 自分の全情報 + 全員分 |
| admin（後道さん等） | **全員の可視化情報 + ロードマップ + 月次ダイジェスト** |
| manager | 全員の「**忙しさ指標のみ**」+ 自分の詳細 |
| staff / cs / closer / toss | 自分の分のみ |

### Chatwork 連携（エンタープライズプラン活用）

**Garden 専用ルーム「Garden開発進捗」を新設**し、以下を自動投稿：

| 頻度 | 内容 | 送信タイミング |
|---|---|---|
| **日次** | 完了タスク数・ハイライト・明日予定・全体進捗%・URL | 毎日18:00 |
| **週次** | 今週の成果・月次目標達成率・アラート・グラフ画像 | 毎週金曜18:00 |
| **月次** | 月次ダイジェスト（会議前日・毎月14日） | 毎月14日18:00 |
| **重要アラート** | PRマージ・Phase完了・スケジュール変更 | 随時 |

現行の個人日報ルーム（`send_report.py`）とは**別ルーム**で共存。

### 月次会議対応（最重要）

**毎月15-20日の責任者会議で使用** → **月次ダイジェスト画面** を最重要視。

- 大画面投影モード（1ページ1情報、文字大きく）
- PDF エクスポート（会議資料として印刷可）
- 画像保存（Chatwork 貼付用）
- 前日（14日）に Chatwork 自動投稿で事前共有

## 他モジュール引っ越し可能な疎結合設計

将来的に Garden-Seed（新事業枠）や他モジュールへ移植できるよう、**疎結合** で実装：

### ディレクトリ構成

```
src/app/bloom/
  └── workboard/
       ├── components/      ← 汎用コンポーネント（モジュール依存なし）
       ├── _lib/            ← データ層（Bloom 外でも再利用可）
       ├── _constants/      ← モジュール非依存の定数
       ├── _types/          ← 型定義
       └── page.tsx         ← Bloom専用エントリ（薄い層のみ）
```

### DBスキーマの命名規則

```sql
-- 引っ越し容易化のため、モジュール名プレフィックス
CREATE TABLE bloom_worker_status (...);
CREATE TABLE bloom_daily_logs (...);
CREATE TABLE bloom_roadmap_entries (...);
CREATE TABLE bloom_project_progress (...);

-- 将来の引っ越し時（例：Garden-Seed へ移植）
-- ALTER TABLE bloom_worker_status RENAME TO seed_worker_status;
```

### 移植手順（将来）

1. `components/` と `_lib/` を新モジュールへコピー
2. Supabase テーブルをリネーム
3. `_state` の Context を新モジュール用に再接続
4. → **1-2時間で移植完了** する構造

## 表示切替：👥みんな向け / ⚙️開発向け

画面右上のトグルで切替、**localStorage で状態保存**。

### 切替例

| 項目 | 👥みんな向け | ⚙️開発向け |
|---|---|---|
| モジュール名 | 経理ソフト / 経営ダッシュボード | Garden-Bud / Garden-Forest |
| タスク | 「振込管理の土台構築」 | `feature/bud-phase-0-auth` Task 5 |
| 進捗率 | 22% | Phase A 22%（M1 目標 30%） |
| 技術用語 | ほぼ使わない | 全て専門用語 |

## 想定依存

- **Garden-Root**: 従業員マスタ（email・role）参照
- **Garden-Tree**: KPI（架電ポイント等、将来統合）
- **Garden-Leaf**: 案件データ（将来統合）
- **Garden-Bud**: 経理データ（営業損益計算用、将来統合）
- **Supabase Auth**: 認証（Forest と同じシステム流用）
- **Chatwork API**: 通知連携（エンタープライズプラン）
- **Vercel Cron**: 定期実行（日次・週次・月次）

## UI方針

- 親CLAUDE.md §6 FileMaker風UX仕様に準拠
- Forest 設計思想踏襲（グリーン系グラデーション）
- レスポンシブ対応（親CLAUDE.md §7）
- 認証は Forest 既存を流用

## Phase A-1 実装計画（M1）

| タスク | 工数 | ブランチ |
|---|---|---|
| Bloom 基盤（認証・ナビ・レイアウト） | 0.5d | feature/bloom-foundation-20260424 |
| Supabase migration（bloom_* テーブル） | 0.5d | 同上 |
| Workboard 画面（個人可視化） | 0.5d | 同上 |
| Roadmap 画面（全体進捗） | 0.5d | 同上 |
| 月次ダイジェスト画面（会議用） | 0.5d | 同上 |
| 切替機能・アラート・認証 | 0.25d | 同上 |
| Chatwork 連携基盤 | 0.25d | 同上 |
| 日次・週次・月次 Cron | 1.0d | 同上 |
| 他モジュール引っ越し可能な疎結合化 | 0.25d | 同上 |
| Tree管理者画面への連携 | 0.25d | Phase D |
| **Phase A-1 合計** | **約 4d** | |

## 関連メモリ
- `project_garden_modules`
- `project_garden_filemaker_ux`
- `feedback_autonomous_mode_reporting`（autoモード隠蔽と日報ルール）
- `feedback_praise_not_rest`（褒めるスタイル）
- `feedback_proposal_with_drawbacks`（デメリット併記）

## 関連ドキュメント（実装後）

- `docs/specs/2026-04-24-bloom-workboard-design.md` — 詳細設計書（実装時作成）
- `docs/garden-release-roadmap-20260424.md`（a-auto 生成済）— ロードマップ元データ
- `docs/forest-v9-to-tsx-migration-plan.md`（a-auto 生成済）— Forest 拡張の計画
