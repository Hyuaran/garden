# 🔍 a-review レビュー — Garden Sprout（仮）+ オンボーディング再設計 v0.1 → v0.2 草稿

## 📋 概要

採用 → 面接 → 内定 → 入社準備 → 在職中 → 退職 までの業務フロー全体を再設計する v0.1 → v0.2 草稿（合計 737 行 / 概念整理段階）。Garden Sprout モジュール新設、Root への退職フロー組込、MFC（マネーフォワードクラウド）連携、iPad ガイド枠カメラ、申請承認パターン、LINE 2 アカウント運用、Garden カレンダー独自実装、Fruit モジュール連携、6 法人取込までを包含。a-auto Batch 18 への詳細起草の前段資料。

## ✅ 良い点

1. **現状業務の精緻な棚卸し（§1）**: 入力ポイント数 4 つ（MFC + LINE + Kintone じぶんフォーム × 2 + Kintone 手動）の現状把握が具体的、問題点（手動転記ミス / セキュリティ / 営業負担）の整理が明快。memory「品質最優先 / リリース遅延は許容」と整合。
2. **memory 5 件への忠実な整合**: §1 関連 memory 列挙（change_request_pattern / login_office_only / quality_over_speed / chatwork_bot_ownership / kintone_tokens_storage）。各設計判断が memory ルールに直接対応。
3. **判 1-4 の確定設計判断（§3）**: 写真添付 = iPad ガイド枠（Leaf 関電方式）/ 全項目申請承認 / MFC C 案 / 退職フロー Root 組込 を表形式で根拠付き。東海林さん 4 設計点確定済の状態が明示されており、a-auto Batch 18 への引継ぎ準備として優秀。
4. **iPad image-capture 共通ライブラリ化（§3 判 1）**: a-leaf の HEIC + Canvas + Worker ラッパを `src/lib/image-capture/` に切り出し、Leaf / Sprout / Root 横断で再利用。Phase B スコープ拡張として spec 内で明示。
5. **LINE 2 アカウント運用（v0.2 §6）**: 入社前（ヒュアラン_info）/ 入社後（スタッフ連絡用_official）の現状把握 + 環境変数設計（`LINE_CHANNEL_ACCESS_TOKEN_INFO` / `_OFFICIAL`）。memory `project_kintone_tokens_storage.md` のパターン踏襲。
6. **マイナンバー pgcrypto 暗号化（§4.1）**: `my_number_encrypted bytea` で機密データ保護。PR #74 D-06 の整合性も自然。
7. **退職フロー対称設計（§5.4）**: 入社の対称として退職を設計、書面 4 種（雇用契約書 / 秘密保持 / 緊急連絡 / 退職届）の MFC 締結 + 状態遷移（TERMINATING → TERMINATED）まで定義。
8. **MFC PDF 受領済反映（v0.2 §14）**: 4 PDF（雇用契約書 ver.2 / 秘密保持 ver.3 / 緊急連絡 ver.1 / 退職届 ver.1）の Fruit から取得 / 本人入力 / spec 固定の 3 分類が明示。テンプレ生成の動的フィールド設計が具体的。
9. **タイムツリー API 非対応 → Garden カレンダー B 案採択（§15）**: 現実的なフォールバック判断。スマホ閲覧の例外設定（staff 以上）+ memory `project_garden_login_office_only.md` の補正必要性まで明記。

## 🔴 / 🟡 / 🟢 指摘事項

### 🔴 §3 判 3 「MFC で締結 → Garden アップロード → OCR」の OCR 失敗時のフォールバックなし

「OCR で必要情報（締結日 / 契約期間 / 同意項目）を自動抽出」（L108）。**しかし、MFC PDF のレイアウト変更や OCR 誤認時のフォールバックフローが未定義**。

→ §3 判 3 に「OCR 失敗 / 結果不一致時は管理者の手動確認 UI」を追加すべき。Forest の進行期 PDF と同手法（pdfjs-dist）を流用するなら、Forest 既知の OCR エラーパターンを known-pitfalls 参照で対策。Sprout v0.2 の現状では「OCR 100% 成功」前提の実装になりかねない。

### 🔴 §4.1 sprout_pre_employment_data の「ログインなし URL」が脆弱（v0.1 想定）

§4.2 「応募者：本人のみ、トークン認証経由（ログインなし URL）」。**面接ヒアリングシート（Kintone じぶんフォーム後継）を予約 URL 経由でログイン不要に開放することは、URL 漏洩 = 個人情報漏洩**の経路になる。

→ 解決策:
- (a) URL に強固なトークン（128bit）+ TTL（24h）+ 一度入力したら無効化
- (b) LINE Bot 経由で認証コードを別途送信、URL + コードで認証
- (c) 段階的に Sprout 側で「LINE 友だち + token」のセット認証

memory「品質最優先」+ 個人情報保護法（マイナンバー含む）+ §16 厳格度 Tree/Bud/Root と同等の慎重さが必要。**§4.2 RLS spec 単独ではセキュリティが不十分**。

### 🔴 §5.3 ステップ 8「Sprout → Root 完全転記」のトランザクション整合性未定義

「sprout_pre_employment_data → root_employees + 各サブテーブル」（L335）の転記が**spec 内で「関連コミット記録（root_audit_log）」と書かれているが、Trx 内整合性 / 部分失敗時のロールバック / 転記済 → Sprout 側の論理削除タイミング**が未定義。

→ 5.3 §8 を補強:
- 単一 Server Action 内で `BEGIN; INSERT root_employees ...; INSERT sub_tables...; UPDATE sprout_pre_employment_data SET migrated_at = now(); COMMIT;` パターン明示
- 失敗時のロールバック + 担当者通知
- Sprout 側は転記後も保持、論理削除 = 退職時または法令保存期間（§5.4 の 7 年）

### 🔴 §6.4 LINE Bot 配信失敗リトライ「1h / 6h / 24h」の累計受信時間

「配信失敗時のリトライ：1h / 6h / 24h（A-07 採択ロジック踏襲）」。**A-07 採択は給与明細メール経路。LINE 採用面接予約とは性質が異なる**（面接 24h 後では予約自体が成立しない）。

→ Sprout の面接予約 LINE 通知は「初回失敗 → 5 分後 → 30 分後 → 1h 後で配信失敗判定 → 営業に手動アラート」等、業務性質に合わせた粒度に変更要。判断保留に追加。

### 🟡 §3 判 2 申請承認パターン「全項目」の業務効率懸念

「変更時：『変更申請』ボタン → モーダル入力 → 承認待ち → admin 承認後反映」（L94）。**例外を除き全項目を承認待ちにすると、admin（東海林さん）の承認業務が日次で大量化**。

→ 例外項目の拡張を検討:
- 入社前（オリエン中）の本人による直接入力は申請なし即時保存
- 入社後の変更のみ申請承認パターン
- 軽微項目（連絡先電話番号等）は manager 承認で OK

memory `project_garden_change_request_pattern.md` の方針を spec 内で再整理推奨。

### 🟡 §4.1 テーブルスキーマが `id` 列前提だが Garden 既存テーブル命名と整合しない

```sql
sprout_applicants (id uuid pk, ...);
```
PR #47 cross-history-delete-01 の Trigger 関数 `NEW.id::text` 問題と同根。**Garden 主要テーブルの PK 命名は混在**（`employee_number` text / `case_id` uuid / `id` uuid）。Sprout も他モジュールと同じく `applicant_id` / `interview_slot_id` 等の **明示的命名** が望ましい。

→ §4.1 を `sprout_applicants(applicant_id uuid pk, ...)` 形式に変更。PR #47 cross-history-delete の Trigger 適用時に PK 列名を `TG_ARGV[1]` で受けるように整合。

### 🟡 §6 LINE 2 アカウント連携テーブル `sprout_line_messages` / `root_line_messages` の責務分担

§6.4「メッセージ履歴: `sprout_line_messages`（入社前）/ `root_line_messages`（入社後、または横断テーブル）」（L404）。**「または横断テーブル」と曖昧**で、LINE Bot 開発時に判断が分かれる。

→ §6.x として「単一横断テーブル `garden_line_messages` に `module text` + `account_type text` カラム」推奨。Cross History (#47) との整合性も自然。

### 🟡 §15 Garden カレンダーの位置づけ「新モジュール独立 vs Bloom 統合」

§15.3 で A 案（独立）が推奨されているが、**CLAUDE.md §18 Phase 配置との整合性が未確定**。Phase B（Sprout 配置）に入れるなら同時進行、Phase C（Bloom）に入れるなら Sprout 面接予約はカレンダーに依存できない。

→ §15.3 + §15.6 の判断保留として「Phase B 着手前に確定」を明示。Sprout 面接予約 MVP は spec_interview_slots テーブルで自前実装、Phase C で Garden カレンダー統合 という段階展開も検討。

### 🟡 §14.1 雇用契約書の「シフト A/B/C」のハードコードは v0.2 段階で OK だが将来拡張不可

§14.1 シフト：A（14:00-21:00 / 休憩 45 分）/ B / C のように **3 種固定**で spec 内に書かれている。**シフトパターンが追加された時に spec 改訂 + 雇用契約書テンプレ改訂が連鎖発生**。

→ Sprout v0.2 段階の概念整理としては OK だが、§14.x に「Phase B 詳細化時に shift_patterns マスタテーブルへ移動」と注記推奨。

### 🟡 §7.2 既存従業員 40+ 名の Garden 移行戦略「A/B/C」未確定

「Phase A-2 完了後、Phase B 実装着手前に判断」（L437）。**Phase A-2 完了タイミングが Sprout Phase B 着手と重なる場合、判断遅延が連鎖**。

→ 早期に判断（Phase A-2 中盤に判断仰ぐ）を推奨。判断保留 §9 にも追加。

### 🟢 §6.1 LINE 2 アカウント運用での「入社後にヒュアラン_info ブロック / 友だち削除」が任意

「ヒュアラン_info はブロック / 友だち削除を依頼（任意、Sprout から促し）」（L376）。**任意のため、入社後もヒュアラン_info に残っているメンバーがいて、採用情報配信を受け続ける**。

→ admin 側で「入社済 LINE ID リスト」を保持、ヒュアラン_info 配信時に除外フィルタすれば実害なし。spec 内に「入社後の自動除外フィルタ」追加推奨。

### 🟢 §4.1 sprout_pre_employment_data に `data_input_completed_at` あるが `migrated_to_root_at` がない

§5.3 ステップ 8「Sprout から Root へ完全転記」の状態管理列がない。`migrated_to_root_at timestamptz` + `migrated_root_employee_id uuid` の追加推奨。

### 🟢 §10 改訂履歴に v0.1 の「東海林さん 4 設計点確定」が v0.2 で「+ 4 PDF 受領 + LINE 2 アカウント + タイムツリー API 非対応 + Fruit 実体化 + 6 法人 Kintone 取込」と明記

進捗トラッキングは良好。次回 v0.3 で「LINE Bot 配信失敗リトライ業務性質別」「Sprout → Root 転記 Trx」「OCR フォールバック」を追加できれば概念整理完了。

## 📚 横断整合チェック

### known-pitfalls.md との整合
- ⚠️ **#1 timestamptz 空文字**: §4.1 のテーブル定義が抽象的で `created_at, updated_at` のみ列挙、DEFAULT now() 明示なし。a-auto Batch 18 での詳細化時に sanitize-payload パターン参照要
- ⚠️ **#2 RLS anon 流用**: §4.2「ログインなし URL」のセキュリティが #2 想定外（指摘済）
- ⚠️ **#3 空オブジェクト insert**: 応募者の段階的入力で空 payload が来うるが REQUIRED_FIELDS 設計言及なし
- ✅ #6 garden_role CHECK: §5.2 内定の garden_role 仮設定範囲を toss/closer/cs/staff のみに限定 → memory 整合
- ⚠️ **#8 deleted_at vs is_active**: §5.3 ステップ 1 `is_active = false` / status = 'pending' で表現、`deleted_at` 軸との分離が spec 内で言及なし

### 既存 spec / CLAUDE.md との矛盾
- ⚠️ **PR #47 cross-history-delete との連動**: Sprout 全テーブルが garden_change_history Trigger 適用対象になるか言及なし。応募者の本人情報変更履歴は法令上記録要
- ⚠️ **PR #74 Bud Phase D との連動**: §5.3 ステップ 8 で root_employees + bud_employee_allowances の連携が未明示。給与受取口座 = bud 連携の責務
- ⚠️ **PR #51 Cross Ops との連動**: §5.4 退職時の法令保存期間（マイナンバー 7 年）が #05 data-retention の表（給与 5 年 / 振込 7 年）と並列に整理されるべき
- ✅ §17 段階展開と整合（既存従業員移行を Phase A-2 完了後に判断）
- ✅ §18 Phase 配置への追加提案が明示（Phase B 配置）

### memory ルールとの整合
- ✅ **削除パターン**: §4.3 で論理削除全員 / 物理削除 admin / 削除済バッジ全員可視 → 整合
- ✅ **権限ポリシー設定変更可能設計**: §3 判 2 で `root_settings` で項目別 min_role を可変設定（ハードコード禁止）→ 完璧に整合
- ✅ **品質最優先**: §1 現状の問題点 4 つ + 目指す姿 4 つ で品質改善の方針が明確
- ✅ **Chatwork Bot ownership**: §1 関連 memory に明示
- ✅ **Kintone トークン保存場所**: §6.5 LINE 環境変数を `.env.local` 全 10 セッション保存と明示
- ⚠️ **Garden ログインは社内 PC のみ**: §15.5 で staff 以上スマホ閲覧 OK 例外設定の必要性を spec 内で明記、memory `project_garden_login_office_only.md` の補正が pending

## 🚦 判定

**LGTM（条件付き、概念整理段階としては問題なし）**

判定理由:
1. **v0.1/v0.2 草稿として**: 概念整理段階の spec として網羅性 / memory 整合性 / 4 設計判断確定 / PDF 受領反映 が高水準。Phase 配置提案も明示。a-auto Batch 18 への引継ぎ資料として十分。
2. **マージ前修正必須なし**: 草稿の性質上、矛盾の致命性は低い。docs PR としては merge 後に a-auto Batch 18 で詳細化する手順で問題なし。
3. **a-auto Batch 18 起草前に解消すべき指摘**:
   - 🔴 §3 判 3 OCR 失敗フォールバック
   - 🔴 §4.2 「ログインなし URL」のセキュリティ強化（トークン + TTL）
   - 🔴 §5.3 Sprout → Root 転記 Trx 整合性
   - 🔴 §6.4 LINE Bot 配信リトライの業務性質別粒度
4. **次回改訂（v0.3 or Batch 18 詳細化）で取り込むべき**:
   - 🟡 §3 判 2 申請承認の例外拡張
   - 🟡 §4.1 PK 命名統一（applicant_id 形式）
   - 🟡 §6 LINE メッセージテーブル単一横断化
   - 🟡 §15 Garden カレンダーの Phase 配置確定
   - 🟡 §7.2 既存従業員移行戦略の早期判断

ただし、概念整理段階で**この spec が a-auto Batch 18 の起草入力**になり、誤りや不明瞭点がそのまま実装指示書に伝播するリスクがあるため、**マージ前に上記 🔴 4 件のうち少なくとも §4.2 セキュリティと §5.3 Trx 整合性は明示的に解消する v0.3 改訂を強く推奨**（草稿質を維持した状態で）。

memory「品質最優先」を Sprout 全体に適用するなら、概念整理段階でも「個人情報を扱う本フローに脆弱性があれば現場投入できない」という前提を spec 冒頭に追加する選択肢もある。

---
🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)
