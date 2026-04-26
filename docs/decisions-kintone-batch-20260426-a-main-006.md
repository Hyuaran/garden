# Kintone 解析 判断保留 一括処理 確定ログ - 2026-04-26 - a-main 006

> 本ログは 2026-04-26 a-main 006 セッションで東海林さんから即決承認を受けた **32 件の Kintone 解析設計判断**を恒久記録する。
> 各セッション（a-bud / a-tree / a-auto / a-leaf 等）が spec 改訂時に参照すべき確定事項。

**日時**：2026-04-26 a-main 006 セッション
**承認者**：東海林美琴
**実行者**：a-main 006
**所要時間**：約 1.5 時間（Kintone 6 アプリ + 関連 Excel 解析含む）

---

## 1. 関連 Kintone アプリ（解析対象）

| App ID | 正式名称 | 解析担当 spec | 移行先 |
|---|---|---|---|
| 28 | 法人名簿 ヒュアラングループ | `2026-04-26-kintone-fruit-sprout-mapping-analysis.md` | Garden Fruit |
| 44 | 求人 応募者一覧 | 同上 | Garden Sprout |
| 45 | 求人 面接ヒアリングシート | 同上 | Garden Sprout（統合） |
| 56 | 従業員名簿 ヒュアラングループ | `2026-04-26-kintone-employee-payroll-analysis.md` | Garden Root |
| 21 | 給与一覧 | 同上 | Garden Bud Phase D + MFC |
| 85 | 決算書 ヒュアラングループ | 同上 | Garden Forest + Fruit |
| 92 | 口座一覧 | 同上 | Garden Sprout + Root |
| 93 | 交通費一覧 | 同上 | Garden Sprout + Root |
| 95 | 経費一覧 | 同上 | Garden Bud + Leaf 関電 |

---

## 2. 確定事項 32 件（カテゴリ別）

### 2.1 Sprout / Fruit 設計（11 件）

| # | 項目 | 確定内容 |
|---|---|---|
| 1 | App 28（法人名簿 ヒュアラングループ）サブテーブル統合 | 契約物件 / 契約車 / サブスク → `fruit_company_contracts` テーブルに `type` 列で統合 |
| 2 | LINK 系（登記簿 / 定款 / 印鑑証明）保管場所 | Google Drive 維持 + Phase B-1 で Supabase Storage 段階移行 |
| 3 | App 28 住所重複 | 会社住所カナ / address / 英語表記 **全部保持**（検索 + コピー貼付用途） |
| 4 | App 45（求人 面接ヒアリングシート）サブテーブル「配属・異動」運用 | 採用前 = Sprout / 採用後 = Root に移管 |
| 5 | ◇マーク = 自動計算列（regex 等） | Garden では trigger / GENERATED 列で 1 列統合（重複保持不要） |
| 6 | App 44（求人 応募者一覧）「Web 面接 URL」運用 | 現状未使用 → Garden では将来枠として **Google Meet 都度発行**設計（無料 + Google Calendar API + 設計相性◎） |
| 7 | App 44 ルックアップ方向判明 | App 45 → App 44 へ大量コピー（30+ フィールド）、App 45 が詳細マスタ |
| 8 | **Sprout 応募者テーブル設計** ⭐ | 単一 `sprout_applicants` テーブル + 6 タブ UI（基本情報 / 連絡先・住所 / 学歴・職歴 / 勤務希望 / 応募・面接 / 採用・配属） |
| 9 | Sprout ステータス設計 | Garden Leaf 関電方式の矢印フロー + 日付ベース自動遷移 |
| 10 | App 44 / App 45 取込タイミング | 応募時 → App 44 自動 / ヒアリング送信時 → App 45 自動 |
| 11 | enum 値の root_settings 化範囲 | 性別 / 都道府県 / 学歴 / 職歴種別 |

### 2.2 Sprout ステータス挙動詳細（4 件）

| # | 項目 | 確定内容 |
|---|---|---|
| 12 | ステータスマッピング | 提案通り採用（5 phase: 対応中 / 面接待ち / 採用待ち / 研修待ち / 入社済み + 2 exit: 留守等辞退 / 不採用） |
| 13 | 「シート待ち」 | App 45（求人 面接ヒアリングシート）未提出待ちで確定 |
| 14 | 「本日研修予定」 | 研修当日 0:00 で自動付与（日次バッチ） |
| 15 | 3 次留守超 → 留守等辞退 自動遷移 | 7 日経過で自動遷移（手動確認不要）+ `auto_declined` フラグ + 管理者向け絞込ビュー必須 |

### 2.3 Bud Phase D 給与計算（5 件）

| # | 項目 | 確定内容 |
|---|---|---|
| 16 | App 92（口座一覧）口座分離設計 | `employee_bank_accounts`（全従業員、給与口座）+ `payment_recipients`（外部支払先 + 特殊扱い 10 名、月変動）。`payment_recipients.employee_id` NULL 可、月単位レコード対応 |
| 17 | Excel 依存特定 | 「【月1】給与計算用」シート → Garden Bud Phase D（給与計算 module）に統合。Bloom が集計可視化、Tree が源泉データ提供 |
| 18 | 給与権限境界（Garden ロール対応）| 計算者（上田）= `payroll_calculator` / 承認者（宮永・小泉）= `payroll_approver` / MFC インポート実行（上田）= `payroll_disburser` / 監査（東海林）= `payroll_auditor` |
| 19 | MFC CSV 仕様判明 | 72 列 / cp932 / 9 カテゴリ（識別 / 所属 / 所定 / 勤怠 / 月給 / 時給 / 日給 / 控除 / 備考）。memory `project_mfc_payroll_csv_format.md` 参照 |
| 20 | 給与計算 Excel 完全排除 | Bud Phase D で完全代替、Excel 廃止（東海林さん「廃止大歓迎」） |

### 2.4 Forest / 経費 / その他（6 件）

| # | 項目 | 確定内容 |
|---|---|---|
| 21 | App 85（決算書 ヒュアラングループ）vs Forest 既存 fiscal_periods | Forest fiscal_periods が master、Kintone は移行元アーカイブ |
| 22 | App 95（経費一覧）他事業展開 | 当面関電専用、新事業展開時に拡張可能設計（type / business_id 列） |
| 23 | App 56（従業員名簿 ヒュアラングループ）「打刻 ID」と「KOTID」 | 別フィールド管理 → Garden 移行時に統合候補（おそらく統合可） |
| 24 | App 56 チーム名 3 種 | ◆最終チーム名 = 現在所属、●チーム名 / SUBTABLE 在籍チーム = 履歴系 → Garden は `current_team` + `team_history` 構造 |
| 25 | App 21（給与一覧）「東海林頼んだ Excel」フィールド | 月次報告資料 Excel への参照 → Garden Bud Phase D `bud_payroll_records` に統合、フィールド廃止 |
| 26 | 引越時通勤経路変更フロー | 現状 LINE 手動 + 漏れリスクあり → Garden で**申請承認パターン**で改善（公式 LINE フォーム → Sprout/Root → admin 承認） |

### 2.5 CW_API トークン / Kintone 解約戦略（3 件）

| # | 項目 | 確定内容 |
|---|---|---|
| 27 | CW_API トークン用途 | 管理側が従業員代理で通知送信（用途 B）+ 現在は東海林さん設定用途のみ、運用してない |
| 28 | CW_API トークン Garden 移行 | migration しない、未使用フィールド扱い。将来 Sprout / Bud で代理通知の仕組みが必要なら再設計 |
| 29 | App 56 と root_employees の merge 戦略 | 戦略 A = 既存 root_employees 優先（同じ従業員番号は既存値保持、Kintone は欠損補完のみ）|

### 2.6 全体運用（3 件）

| # | 項目 | 確定内容 |
|---|---|---|
| 30 | LINK 系 Storage 保存タイミング | 応募者登録時に async copy job |
| 31 | 助成金・休業履歴の保管期間 | 初期 10 年運用 → 安定後 7 年へ変更（以前同様の運用） |
| 32 | Kintone 段階的解約 | Phase 1: Garden リリース直後並行運用 1-2 ヶ月（dual-write）→ Phase 2: Kintone 読取専用化 1 ヶ月 → Phase 3: Kintone 解約。Garden 完全運用が確認できてから解約 |

---

## 3. 影響を受ける各セッションの spec / 実装

### 3.1 a-bud（Bud Phase D 給与処理）

優先度：🔴 最高

| 項目 | 影響 spec |
|---|---|
| #16 口座分離 | `2026-04-25-bud-phase-d-04-statement-distribution.md` 改訂、新規 `bud-phase-d-XX-bank-accounts.md` 起草 |
| #17 Excel 排除 / Bud Phase D 統合 | `2026-04-25-bud-phase-d-XX-payroll-calculation.md` 新規起草 |
| #18 給与権限境界 | Bud Phase D 全 spec の RLS / role 列挙 |
| #19 MFC CSV 出力 | `2026-04-25-bud-phase-d-XX-mfc-csv-export.md` 新規起草 |
| #25 「東海林頼んだ Excel」廃止 | App 21 → bud_payroll_records 移行時の field mapping |

### 3.2 a-auto / a-tree（Sprout 関連）

優先度：🟡 中

| 項目 | 影響 spec |
|---|---|
| #1〜#15 Sprout / Fruit 設計 | `2026-04-25-garden-sprout-onboarding-redesign.md` v0.3 改訂、Batch 18 spec 群（a-auto ローカル commit）を 32 件確定に整合 |

### 3.3 a-root（Root 関連）

優先度：🟡 中

| 項目 | 影響 spec |
|---|---|
| #4 配属・異動 採用後 Root 移管 | Root spec への spec sub-section 追加 |
| #24 チーム名 history 構造 | root_employees スキーマに `current_team` + `team_history` |
| #29 root_employees merge 戦略 | Phase B-3 移行 spec |

### 3.4 a-forest（Forest 関連）

優先度：🟢 低

| 項目 | 影響 spec |
|---|---|
| #21 fiscal_periods master 確定 | Forest 既存設計の通り（変更なし、Kintone アーカイブ取込のみ） |

### 3.5 a-leaf（Leaf 関連）

優先度：🟢 低

| 項目 | 影響 spec |
|---|---|
| #22 経費 type / business_id | 将来事業展開時に対応可能な設計を Leaf 拡張 spec に記載 |

---

## 4. 添付資料（共有保管庫）

本判断の根拠となった東海林さん共有資料：

| ファイル | 場所 | 内容 |
|---|---|---|
| baitoru-auto 仕様書 | `C:\garden\_shared\attachments\20260426\baitoru-auto-仕様書.md` | バイトル → App 44 自動同期システム（Sprout 上流） |
| 実件数報告 Excel | `C:\garden\_shared\attachments\20260426\【管理表】実件数報告_20260425.xlsx` | 13 シート、給与計算用シート含む |
| MFC CSV サンプル | `C:\garden\_shared\attachments\20260426\MFC給与CSVサンプル_20260531支給.csv` | 72 列 / cp932 / 9 カテゴリ |
| 月次報告資料 Excel | `C:\garden\_shared\attachments\20260426\月次報告資料__20260412_東海林20260413入力.xlsx` | 75 シート、3 年分賃金台帳含む |

→ 詳細は `C:\garden\_shared\attachments\INDEX.md` 参照。

---

## 5. 関連 memory（一覧）

| memory | 用途 |
|---|---|
| `project_baitoru_auto_existing_system.md` | バイトル自動化システム（Sprout 上流） |
| `project_mfc_payroll_csv_format.md` | MFC CSV 72 列仕様 |
| `project_session_shared_attachments.md` | 全セッション共有添付保管庫 |
| `feedback_kintone_app_reference_format.md` | Kintone アプリ ID + 日本語名併記ルール |
| `project_kintone_tokens_storage.md` | Kintone トークン保存場所 |
| `project_garden_fruit_module.md` | Fruit 実体化（法人法的実体情報） |
| `project_payslip_distribution_design.md` | Y 案 + フォールバック給与配信 |
| `project_garden_change_request_pattern.md` | 全項目「申請 → admin 承認」パターン |
| `project_garden_login_office_only.md` | 社内 PC 限定ログイン |
| `project_delete_pattern_garden_wide.md` | 削除パターン（論理削除全員 / 物理削除 admin） |

---

## 6. 次の動き

| # | アクション | 担当 |
|---|---|---|
| 1 | 本確定 32 件を反映した spec 改訂タスクを a-auto に投下 | a-main 006 → a-auto |
| 2 | a-bud に Bud Phase D 給与計算 + MFC CSV 出力 spec 起草指示 | a-main 006 → a-bud |
| 3 | a-root に root_employees スキーマ拡張（チーム名 history）指示 | 後日（GitHub 復旧 + Phase B 着手時） |
| 4 | docs/effort-tracking.md に本バッチの実績追記 | a-main 006 |

---

## 7. 改訂履歴

- 2026-04-26：初版作成（a-main 006、Kintone batch 32 件確定）
