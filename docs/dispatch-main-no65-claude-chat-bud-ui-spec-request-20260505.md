# main- No. 65 dispatch - claude.ai 作業日報セッションへ Garden Bud UI 試作起草依頼 - 2026-05-05

> 起草: a-main-012
> 用途: Garden Bud（経理モジュール）の UI 試作を claude.ai 作業日報セッションに依頼、項目リスト + 仕様要件
> 番号: main- No. 65
> 起草時刻: 2026-05-05(火) 21:16
> 緊急度: 🟡 5/17 以降の Bud 正式着手向け、5/8 デモ前後で起草開始

---

## 投下用短文（東海林さんが claude.ai 作業日報セッションにコピペ）

~~~
🟡 main- No. 65
【a-main-012 から claude.ai 作業日報セッションへの dispatch（Garden Bud UI 試作起草依頼）】
発信日時: 2026-05-05(火) 21:16

Garden Bud（経理・収支モジュール）の UI 試作起草を依頼します。a-forest が現在仕訳帳機能を Forest 配下で実装中（5/17 以降 Bud へ移行予定）、これと並行して Bud 全体の UI 試作を claude.ai で進めたい。

【Garden Bud モジュールの位置付け】

CLAUDE.md より:
- Bud（蕾）= 経理・収支（明細・振込・損益・給与）
- 樹冠 / 地上 / 地下 の 3 レイヤーモデルで「地上（業務オペ）」配置
- 現状: 未着手（src/app/bud/ 未作成、Phase A で Bud Phase 1b.2 Task 5/13 完了は Forest 内仕訳帳）

【既に進行中の Bud 関連実装（Forest 配下、5/17 以降 Bud に移行）】

a-forest が仕訳帳機能（spec/forest-shiwakechou-design）を実装中:
- bud_* prefix テーブル 6 件（corporations / bank_accounts / master_rules / transactions / yayoi_exports / audit_log）
- 銀行 CSV パーサー（みずほ Excel + 楽天 CSV）
- 確認画面（取引明細編集 + 一括 OK 化）
- 弥生 CSV エクスポート
- balance-overview（後道さん向け前日残高表示）

→ 5/17 以降、これらを `src/app/bud/shiwakechou/` 配下にコピー + Bud 用に再ブランディング。

【Bud UI 試作で必要な画面リスト（claude.ai 起草対象）】

# 1: Bud Top（経理ダッシュボード）

- 当月の経理サマリ（売上 / 経費 / 利益）
- 未処理キュー件数（仕訳待ち / 振込待ち / 経費精算待ち）
- 法人別 タブ or ドロップダウン
- ショートカットボタン（仕訳帳 / 振込 / 給与）

# 2: 仕訳帳（Forest からコピー）

- 既存 spec/forest-shiwakechou-design の Phase 1〜4 を踏襲
- 銀行明細 / クレジットカード / マネーフォワード / 現金領収書 取込
- 共通マスタ管理 / 法人間取引マスタ管理
- 弥生エクスポート

# 3: 振込管理

- 請求書受領 → 振込予定登録 → FB データ出力
- 振込先マスタ（取引先 + 銀行口座）
- 月次振込スケジュール（カレンダー表示）
- 承認フロー（manager 承認 → admin 実行）

# 4: 損益管理

- 月次損益（売上 / 売上原価 / 販管費 / 営業利益）
- 推移グラフ（12 ヶ月）
- 法人別 + 全社合算
- 試算表 PDF 連携（Forest の進行期更新と整合）

# 5: 給与管理（Bud Phase D）

- KoT 勤怠取込 → 集計
- マネーフォワードクラウド給与（MFC）連携（72 列 9 カテゴリ CSV、memory `project_mfc_payroll_csv_format.md` 参照）
- 給与明細配信（メール DL リンク + LINE Bot 通知 + マイページ PW 確認、Y 案、memory `project_payslip_distribution_design.md`）
- 賞与計算

# 6: 請求書管理

- 受領請求書（PDF アップロード or 手動入力）
- 発行請求書（テンプレ生成 → PDF 出力 → 郵送 / メール送信）
- 取引先別 請求履歴

# 7: 経費精算

- 領収書アップロード（OCR は将来）
- 経費明細入力（手動 / インポート）
- 承認フロー（staff 提出 → manager 承認 → admin 仕訳化）
- 経費区分（旅費 / 交際 / 通信 等）

# 8: 銀行口座管理（Forest balance-overview から発展）

- 法人 × 口座 マトリクス（前日残高 + 当日入出金）
- 口座開設・廃止履歴
- 口座マスタ CRUD

# 9: マスタ管理

- 共通仕訳マスタ（パターン → 借方 / 貸方 / 税区分）
- 法人間取引マスタ
- 取引先マスタ（請求先 / 仕入先）
- 経費区分マスタ
- 給与・賞与計算式マスタ

# 10: 監査ログ

- 全 Bud 操作ログ（仕訳作成 / 編集 / 削除 / 振込実行 / 給与確定 等）
- フィルタ（ユーザー / 日時 / アクション種別）
- 出力（PDF / CSV）

# 11: 設定

- ロール管理（admin / executive / manager / staff）
- 通知設定（Chatwork 連携、月次レポート 配信先）
- 弥生連携設定（インポート CSV フォーマット）

【Bud 固有の UI 設計考慮点】

- **数字精度最優先**: tabular-nums フォント（EB Garamond）、3 桁区切り、円表記
- **高速入力**: 経理オペ向けのキーボードショートカット（仕訳行追加 / OK 化 / 弥生出力）
- **テーマカラー**: Bud のシンボルカラー（蕾 = 黄緑 + 金 想定、Bloom 仕様書 §2-2 accent-gold #d4a541 と整合）
- **監査性**: すべての変更履歴 + 承認者 + 承認日時を視認可能
- **後道さん閲覧可能領域**: balance-overview / 損益管理 / 月次推移（read-only、executive ロール）
- **エラー耐性**: 仕訳バリデーション（借方 = 貸方、税区分必須）

【参照すべき既存仕様】

- `_chat_workspace\chat-spec-garden-bloom-design-system-20260505.md`（Bloom 世界観仕様書、フォント / カラー / カード装飾）
- `spec/forest-shiwakechou-design` ブランチ `docs/superpowers/specs/2026-04-26-shiwakechou-bud-migration-design.md`（仕訳帳仕様）
- `project_garden_3layer_visual_model.md`（Bud は地上層）
- `project_mfc_payroll_csv_format.md`（給与 CSV）
- `project_payslip_distribution_design.md`（給与明細配信）
- `project_garden_change_request_pattern.md`（申請承認パターン）
- `project_post_5_5_tasks.md`（Bud は post-5/5 着手）

【依頼方式の選択肢】

| 案 | 内容 | 備考 |
|---|---|---|
| A | claude.ai が **UI 試作（HTML/CSS）** を起草 → `_chat_workspace\garden-bud\ui_drafts\` に配置 | 既存 Bloom 6 画面と同じワークフロー、東海林さん視覚判断容易 |
| B | claude.ai が **画面別仕様書（Markdown）** を起草 → 後で a-bud セッションが UI 起草 | 仕様明確化が先、a-bud がまだ存在しないので時期尚早かも |
| C | A + B 併用（仕様書 + UI 試作）| ボリューム大、5/17 以降の Bud 正式着手まで時間ある |

→ **A 推奨**（Bloom 6 画面と同じ流れで UI 試作 → 東海林さん視覚判断 → a-bud or a-forest が実装）。

【期限・段階】

- 5/8 後道さんデモ後、5/9-5/16 で UI 試作起草
- 5/17 以降 Bud 正式着手時に試作版を実装

優先順序（claude.ai が起草する画面の順番）:
1. Bud Top（最優先、ダッシュボード概観）
2. 仕訳帳（Forest 配下既存実装と整合確認）
3. 振込管理（5/8 後の実業務ニーズ高）
4. 損益管理（後道さん向け visibility）
5. 給与管理（5 月末給与処理目標）
6. 残り（請求書 / 経費 / 監査 / 設定）

【完了報告フォーマット】

claude.ai 作業日報セッションが起草開始時に report-NN で:
- 起草スケジュール（どの画面をいつまでに）
- 起草ファイル path（_chat_workspace\garden-bud\ui_drafts\）
- 質問・確認事項あれば

各画面起草完了時に report-NN で:
- 完成画面 path（HTML / CSS / JS）
- 画面イメージ（視覚 sample）
- 次の起草対象

【dispatch counter】

a-main-012: 次 main- No. 66
claude.ai 作業日報セッション: report-NN

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 21:16 初版（a-main-012、東海林さん依頼「Bud UI 項目テキスト」採用）
