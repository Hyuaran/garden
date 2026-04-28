# Garden Bloom 画面 UI 設計 引き継ぎ表 - Claude Chat 向け - 2026-04-28

> 起草: a-main-009 (Claude Code)
> 用途: Garden Bloom モジュールの実画面 UI 設計を Claude Chat に引き継ぐ
> 前提: 既存実装あり、ホーム画面（GardenUI/index.html v4）と同じ世界観で再デザイン希望

## ① プロジェクト概要

**Garden Series**: 株式会社ヒュアラン（およびグループ全 6 社）の DX 基盤 ERP。FileMaker / Kintone を置き換える社内システム。

- **メインユーザー**: 東海林 美琴（全権管理者、全 6 法人横断）
- **最終決裁者**: 後道代表（採用判定者）
- **世界観**: 「水彩画タッチ × ガラス玉のアイコン × 紙のような温かみ × 植物が育つメタファー」

12 モジュール構成（樹冠 / 地上 / 地下の 3 層）:
- **樹冠**: Bloom（花）/ Fruit（実）/ Seed（種）/ Forest（森）
- **地上**: Bud（蕾）/ Leaf（葉）/ Tree（木）/ Sprout（新芽）
- **地下**: Soil（土）/ Root（根）/ Rill（川）/ Calendar（暦）

## ② Bloom モジュールの役割

**社内向け「見える化」モジュール**: 日報・KPI・営業損益・作業可視化を統合。

| 兄弟モジュール | 役割 |
|---|---|
| Bud（経理） | 経理「処理」 |
| **Bloom（花）** | **社内向け「見える化」** = 日報・KPI・営業損益・Workboard・月次ダイジェスト・ロードマップ |
| Forest（決算） | 決算・会計（公式）|

## ③ Bloom 画面 既実装一覧（Phase A-1 完成済）

| 画面 | URL | 役割 |
|---|---|---|
| **Bloom トップ** | `/bloom` | モジュール入口、各機能へのナビ |
| **Workboard** | `/bloom/workboard` | 個人の作業可視化（東海林さんメイン）|
| **CEO ステータス** | `/bloom/workboard/ceo-status` | 経営者ステータス表示（後道代表用）|
| **ロードマップ** | `/bloom/roadmap` | Garden 全体 12 モジュールの進捗 |
| **月次ダイジェスト一覧** | `/bloom/monthly-digest` | 月次レポート一覧 |
| **月次ダイジェスト詳細** | `/bloom/monthly-digest/[月]` | 月別レポート（PDF export 可能）|
| **月次ダイジェスト編集** | `/bloom/monthly-digest/[月]/edit` | 月別レポート編集 |

## ④ 各画面の機能詳細

### 4-1. Workboard（個人作業可視化）

東海林さんが「何の作業をしているか」を全社員に見せる画面。

**コンポーネント**:
- WorkerStatusCard（現在のステータス: 対応可能 / 取り込み中 / 集中業務中 / 外出中）
- TodayPlanList（本日の予定 3-5 項目）
- RunningProjectCard（進行中プロジェクト）
- WeeklyAchievement（今週の実績）
- NextMilestoneCard（次のマイルストーン）

**目的**:
- 「東海林さんが何してる？」「手を抜いてないか？」問題の解決
- 月次責任者会議（毎月 15-20 日）で使う材料
- Claude API 課金の会社負担正当化

### 4-2. CEO ステータス

後道代表向け、東海林さんの活動を経営者視点で表示。

### 4-3. ロードマップ

**コンポーネント**:
- AnnouncementBanner（重要告知）
- ModuleProgressGrid（12 モジュール進捗 grid）
- OverallProgressBar（全体進捗バー）
- RiskCardList（リスク・遅延カード）
- TimelineChart（M1-M8 タイムライン）

**目的**: Garden 全体のマイルストーン進捗を一覧化。

### 4-4. 月次ダイジェスト

**コンポーネント**:
- DigestCoverPage（表紙）
- WorkSummaryPage（作業サマリ）
- AchievementsPage（達成項目）
- ProgressGraphPage（進捗グラフ）
- NextMonthGoalsPage（来月目標）
- CustomPage（カスタム情報）
- ProjectionViewer（見通しビューア）
- DigestPageRenderer（PDF 化レンダラー）

**目的**: 月次の Garden 全体活動を PDF レポートとしてまとめる、責任者会議資料。

## ⑤ デザインルール（Garden 共通）

### 5-1. カラーパレット（CSS 変数で定義必須）

| 用途 | 変数名 | 値 |
|---|---|---|
| 全体背景（紙風）| `--bg-paper` | `#f5f0e1` |
| カード背景（半透明）| `--bg-card` | `rgba(255, 253, 245, 0.75)` |
| メインテキスト | `--text-main` | `#4a4233` |
| サブテキスト | `--text-sub` | `#8a7f6a` |
| 緑アクセント | `--accent-green-d` | `#7a9968` |
| 金アクセント | `--accent-gold` | `#d4a541` |
| 警告 | `--text-warning` | `#c95a4a` |

### 5-2. フォント

- 日本語: **Noto Serif JP** / **Shippori Mincho**（明朝系）
- 英数字（数値・見出し）: **Cormorant Garamond**（クラシカルなセリフ体）
- ❌ **ゴシック体禁止**、Inter / Roboto 等の一般的フォント禁止

### 5-3. 角丸・影・透明度

- カード角丸: `--radius-card: 18px`
- ガラスっぽさ: `backdrop-filter: blur(6px〜10px)`
- 影: 柔らかい茶系（`rgba(120, 100, 70, ...)`）

### 5-4. アニメーション

- ロード時のフェードインのみ
- ❌ 過剰なホバーアニメーション禁止（業務効率を下げるため）

## ⑥ 既存ホーム画面（参考、デザイン基準）

ChatGPT で生成した v4 理想画像（既採用）:
`G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI\index.html`
（HTML/CSS 完成版、ライトモード）

`C:\garden\_shared\attachments\20260427\ai-images\design-references\home-design-ideal-v4-final.png`
（理想画像、Bloom 画面でも同じ世界観で）

ホーム画面の構成（参考）:
- 上部: AppHeader（ロゴ + 検索 + 日付 + 天気 + システム状態 + ユーザー情報）
- 左: Sidebar 7 項目（ホーム / ダッシュボード / 取引 / 顧客 / ワークフロー / レポート / 設定）
- 中央: 4 KPI カード（売上 / 入金予定 / 架電状況 / 未処理タスク）+ 12 module grid 3×4
- 右: Today's Activity タイムライン（5 件）
- 背景: 大樹 + テラリウム

## ⑦ ユーザー / 権限

| ロール | Bloom 閲覧範囲 |
|---|---|
| **super_admin**（東海林さん）| 全機能、全データ |
| **admin**（後道代表 等）| 全機能、機密情報含む |
| **manager** | 自部門 + 全社サマリ |
| staff | 自分の Workboard + 全体サマリ |
| cs / closer / toss | 自分の作業状態のみ |
| outsource | アクセス不可 |

## ⑧ 依頼事項（Claude Chat に依頼）

### 8-1. デザイン設計対象

以下 5 画面の UI を **ChatGPT で生成可能なレベルで設計**してほしい:

| # | 画面 | 優先度 |
|---|---|---|
| 1 | **Bloom トップ**（モジュール入口、各機能へのカード式ナビ）| 🔴 高 |
| 2 | **Workboard**（個人作業可視化、東海林さんがメイン）| 🔴 高 |
| 3 | **ロードマップ**（Garden 全体 12 モジュール進捗 grid + タイムライン）| 🔴 高 |
| 4 | **月次ダイジェスト一覧**（月別カード式リスト + PDF プレビュー）| 🟡 中 |
| 5 | **CEO ステータス**（後道代表向け、東海林さん活動経営者視点）| 🟡 中 |

### 8-2. 各画面の成果物

| 成果物 | 形式 |
|---|---|
| ChatGPT 用プロンプト | テキスト |
| ChatGPT で生成した画像（参考画像）| PNG（1920x1080）|
| HTML / CSS スケルトン | `000_GardenUI/bloom-pages/{画面名}.html` |
| 配色 / フォント / レイアウト の指示書 | Markdown |

### 8-3. 制約事項（Claude Chat 厳守）

| 制約 | 内容 |
|---|---|
| ファイル削除厳禁 | CLAUDE.md ルール、別名保存（YYYYMMDDHHMMSS）|
| 専門用語禁止 | 中学生でも理解できる言葉 |
| 仕様確認は A 案 / B 案 | マルチプルチョイス形式 |
| デザイン微調整は対話 | Claude Chat と東海林さんで決定 |
| 実装は Claude Code | Next.js / TypeScript / Tailwind |
| 既存 5 画面（実装済）との整合 | 機能は維持、デザインのみ刷新 |

## ⑨ 役割分担

| 作業 | 担当 |
|---|---|
| デザイン設計（配色・配置・トンマナ）| **Claude Chat**（あなた）|
| ChatGPT 用プロンプト起草 | **Claude Chat**|
| 実装（HTML/CSS/JS、Next.js 反映）| Claude Code（私）|
| エラー修正・動作確認 | Claude Code（私）|
| デザイン微調整・確認 | Claude Chat |

## ⑩ GW 中の進行スケジュール想定

| 期間 | 内容 | 担当 |
|---|---|---|
| 4/28-4/29 | 引き継ぎ表確認 + Bloom 5 画面 ChatGPT プロンプト起草 | Claude Chat |
| 4/29-5/2 | 各画面 ChatGPT 生成 + 採用画像確定 | 東海林さん + Claude Chat |
| 5/3-5/5 | 5/5 後道さんデモ準備（ホーム画面メイン）| 既存 |
| 5/5 後 | Bloom 画面 Next.js 実装着手 | Claude Code |

## ⑪ 既存資源

### 11-1. 既存 spec
- `docs/specs/2026-04-24-bloom-workboard-design.md`（Workboard 設計）
- `docs/specs/2026-04-24-bloom-workboard-scaffold.md`（Workboard scaffold）

### 11-2. 既存実装コード
- `src/app/bloom/page.tsx`（Bloom トップ）
- `src/app/bloom/workboard/page.tsx` + components
- `src/app/bloom/roadmap/page.tsx` + components
- `src/app/bloom/monthly-digest/...` + components

### 11-3. デザイン参考
- `000_GardenUI/index.html`（ホーム画面ライトモード版、完成済）
- `000_GardenUI/css/style.css`（CSS 変数 + デザイン本体）
- `000_GardenUI/images/icons/{module}.png`（12 個のガラス玉アイコン）
- `home-design-ideal-v4-final.png`（ChatGPT 生成 理想画像）

## ⑫ 質問・相談先

判断に迷う場合:
- **東海林さん本人**に確認（最優先）
- 他モジュール（Bud / Forest 等）との整合は **Garden 親 CLAUDE.md** 参照
- データ仕様は **Bud / Forest** spec も参考に

---

## Claude Chat への投下用 短文（東海林さんがコピペ）

```
【Garden Bloom 画面 UI 設計 依頼】

GW 期間中（4/28-5/5）の課題として、Garden Bloom モジュールの実画面 UI を ChatGPT 連携で設計してほしいです。

▼ 引き継ぎ書

`G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\015_Gardenシリーズ\000_GardenUI\bloom-page-design-handoff-20260428.md` を読んでください。

（ファイルは Claude Code が起草、私が同フォルダに移動します）

▼ 概要

- Bloom = Garden 12 モジュールの 1 つ「社内向け見える化」（日報 / KPI / Workboard / ロードマップ / 月次ダイジェスト / CEO ステータス）
- 既存実装あり（Phase A-1 完成、Workboard / Roadmap / 月次ダイジェスト 等の機能群）
- ホーム画面（v4 完成版）と **同じ世界観** で 5 画面のデザイン刷新したい

▼ 依頼

5 画面の ChatGPT 生成プロンプト + 配色 / レイアウト指示書 + HTML/CSS スケルトンを作ってほしいです。

優先度（高い順）:
1. Bloom トップ
2. Workboard（個人作業可視化）
3. ロードマップ（12 モジュール進捗）
4. 月次ダイジェスト一覧
5. CEO ステータス

▼ 制約

- 既存ホーム画面と同じ世界観（水彩 + ガラス玉 + 紙風）
- 配色 / フォントは README 5-1, 5-2 厳守
- ファイル削除厳禁、別名保存
- 中学生でも分かる言葉
- 仕様確認は A 案 / B 案 マルチプルチョイス

▼ 役割分担

- デザイン = Claude Chat（あなた）
- 実装 = Claude Code
- 私（東海林）が橋渡し

よろしくお願いします。
```

## 改訂履歴

- 2026-04-28 初版（a-main-009、Garden Bloom 5 画面 UI 設計の Claude Chat 引き継ぎ表）
