# post-5/5 Phase B 着手前段階整理（V7-G 計画）- 2026-04-27

> 起草: a-main-009
> 用途: 5/5 後道さん採用判定後、Phase B 各モジュール（Sprout / Fruit / Calendar）着手前の整理
> 前提: V7-A〜V7-F まで完了想定、5/5 デモ通過、Garden 採用ゲートクリア

## Phase B 全体像（CLAUDE.md §18 改訂版より）

| モジュール | 内容 | spec 状態 | 工数見積 | 優先度 |
|---|---|---|---|---|
| **Garden-Sprout（仮）** | 採用→面接→内定→入社準備、雇用契約書 / 秘密保持 / 退職届 / 緊急連絡先届、LINE 2 アカウント運用 | ✅ a-auto Batch 18 で 7 spec 起草済（1,850 行）| ~7d | 🔴 高 |
| **Garden-Fruit** | 法人法的実体情報（番号系・許認可・登記簿）、Kintone App 28 法人名簿（6 法人取込）| ✅ a-auto Batch 18 で 5 spec 起草済（1,579 行 / 5.25d）| ~5.25d | 🔴 高 |
| **Garden-Calendar（仮）** | 営業予定・面接スロット・シフト・通知統合、staff 以上のみ | ✅ a-auto Batch 18 で 6 spec 起草済（1,518 行）| ~6d | 🟡 中 |
| **Garden-Bud 給与処理 Phase B-D** | 勤怠取込・計算・配信・MFC CSV・上田目視ダブルチェック | ✅ spec 完成（A-07 採択 + 4 次 follow-up） | ~10d | 🟡 中 |
| **Garden-Leaf 他商材** | 光回線 / クレカ / その他 ~30 テーブル | ✅ skeleton 5 件（PR #40）| 各 1-2d | 🟢 低 |

合計 Phase B 想定工数: **約 28d**（並列実行で 4 週間〜1.5 ヶ月）

## Sprout 詳細（a-auto Batch 18 起草済）

### spec 7 件構成

| # | spec | 内容 |
|---|---|---|
| 01 | 候補者パイプライン | バイトル → Kintone App 44 → Garden 取込 |
| 02 | 面接スケジュール | Calendar 連携、面接スロット |
| 03 | 内定→入社準備 | 4 書面（雇用契約書 / 秘密保持 / 退職届 / 緊急連絡先届）|
| 04 | 仮アカウント発行 | LINE 「ヒュアラン_info」アカウント |
| 05 | 入社初日フロー | 本アカウント化、root_employees 登録 |
| 06 | LINE 2 アカウント運用 | info（採用前）/ official（在職）の使い分け |
| 07 | 退職フロー | 退職届 + 緊急連絡先届の保管期間 |

### 既存システムとの連携

- **baitoru-auto**: 既存自動化（バイトル → Kintone App 44）、Cloud Run 稼働中、memory `project_baitoru_auto_existing_system.md`
- **Kintone App 44**: 候補者パイプライン
- **LINE Bot**: 2 アカウント運用、API 連携必要

### 着手前の判断保留事項

- LINE Bot 2 アカウントの API 利用料 / 課金（東海林さん確認）
- 4 書面のテンプレ確定（既反映、変更不要）
- 退職届の保管期間（労基法準拠）

## Fruit 詳細（a-auto Batch 18 起草済）

### spec 5 件構成

| # | spec | 内容 |
|---|---|---|
| 01 | 法人マスタ schema | fruit_corporations、Kintone App 28 連動 |
| 02 | 番号系管理 | 法人番号 / インボイス / 各種届出番号 |
| 03 | 許認可管理 | 業種別許認可（古物商 / 派遣 / 建設業 等） |
| 04 | 登記簿管理 | 登記簿謄本 PDF 保管、変更履歴 |
| 05 | 横断参照 API | Sprout / Bud / Forest / Root から参照 |

### Kintone App 28 法人名簿 6 法人

- 株式会社ヒュアラン（本体）
- グループ全 6 社（子会社等）
- 61 フィールド → fruit_corporations への正規化マッピング必要

### 着手前の判断保留事項

- 登記簿 PDF の Storage 場所（Supabase Storage vs GitHub）→ memory `project_forest_files_in_google_drive.md` 関連
- 許認可期限切れアラート（Calendar 連携）
- 「会社」表現禁止（memory `project_super_admin_operation.md`、東海林さん本人 = 全 6 社代理）

## Calendar 詳細（a-auto Batch 18 起草済）

### spec 6 件構成

| # | spec | 内容 |
|---|---|---|
| 01 | カレンダー基本 schema | 営業予定 / 面接 / シフト / 通知 |
| 02 | 面接スロット管理 | Sprout 連携、空き時間表示 |
| 03 | シフト管理 | 従業員別、休暇申請 |
| 04 | 通知統合 | Bloom Cron 3 / Chatwork 連携 |
| 05 | 権限管理 | staff 以上のみ閲覧 / 入力（toss / closer / cs は対象外）|
| 06 | スマホ閲覧 | 例外的にスマホ OK（社内 PC 限定の例外、project_garden_login_office_only 補正済）|

### 既存システム migration

- タイムツリー: API 非対応のため Garden 独自実装
- Google Calendar: 連携可能なら検討

### 着手前の判断保留事項

- 面接スロット ↔ Sprout 候補者パイプラインの順序
- シフト管理のテンプレ（過去 Excel あれば取込）
- スマホ閲覧の認証フロー（既存 office-only との調整）

## 着手順序提案（Phase B 全体）

| 週 | 内容 | 担当セッション |
|---|---|---|
| 5/5 後 1 週目 | V7-F（post-5/5 動的化）+ 各 PR merge + α 版準備 | a-bloom-002 + a-tree |
| 5/12 〜 5/19 | **Garden-Fruit 着手**（Phase B 起点、Kintone App 28 取込）| 新セッション or a-auto |
| 5/19 〜 5/26 | **Garden-Sprout 着手**（候補者パイプライン → 入社）| 新セッション |
| 5/19 〜 5/26 | **Garden-Calendar 着手**（Sprout と並行）| 新セッション |
| 5/26 〜 6/9 | Bud Phase B-D 給与処理（並行）| a-bud |
| 6/2 〜 | Leaf 他商材（並行）| a-leaf |

→ 6 月末で Phase B 完了、6 月後半から Phase C（Soil / Bloom Phase A-2）着手。

## 並行戦略（memory `feedback_parallelization_preference.md` 準拠）

- **Phase A 対話作業中** → Phase B 設計書起草・分析を a-auto に並列投入
- **subagent-driven-development** + 並列 sonnet dispatch（実績: a-auto が 18 spec を 7 分で完走）
- ボトルネック: Leaf の商材量（約 30 テーブル）→ 早期 a-auto skeleton 生成
- 槙さん（org owner）は引き続き Owner 維持、別タスクで稼働可

## 判断保留 統合

各モジュールの判断保留事項を統合:

| カテゴリ | 件数 | 例 |
|---|---|---|
| LINE Bot 課金 | 1 件 | 月額確認 |
| Storage 場所 | 1 件 | 登記簿 PDF Supabase vs GitHub |
| 許認可期限アラート | 1 件 | Calendar 連携 |
| 面接スロット ↔ Sprout 順序 | 1 件 | データフロー |
| シフト管理 Excel 取込 | 1 件 | 過去資料調査 |
| スマホ閲覧 認証 | 1 件 | office-only との調整 |

→ 6 件、5/5 後道さんデモ後に東海林さんと確認会議推奨。

## 改訂履歴

- 2026-04-27 初版（a-main-009、Phase B Sprout/Fruit/Calendar 着手前段階整理、6 月末完成想定）
