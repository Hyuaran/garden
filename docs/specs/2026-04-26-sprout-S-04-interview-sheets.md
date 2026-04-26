# Sprout S-04: 面接ヒアリングシート（Kintone App 45 移植）

- 対象: 既存 Kintone App 45（41 フィールド）の構造を Sprout に移植し、面接時の入力 UI と記録テーブルを構築
- 優先度: 🔴
- 見積: **1.50d**（0.25d 刻み）
- 担当セッション: a-sprout / a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Sprout S-04）
- 前提:
  - **Sprout v0.2 spec**（PR #76 merge 済）
  - 関連 spec: S-01（migrations: sprout_interview_sheets / records）、S-03（予約から記録への遷移）、S-07（合格 → 仮アカウント発行）
  - Kintone App 45 のフィールド一覧 CSV（事前取得済想定。実取得は東海林さん経由）

---

## 1. 目的とスコープ

### 1.1 目的

Kintone 上で運用されてきた面接ヒアリングシートの構造を保ったまま Sprout に移し、面接担当者が iPad / PC で素早く記録でき、評価結果がそのまま採用判定に直結する仕組みを作る。

### 1.2 含めるもの

- Kintone App 45 → Sprout へのフィールド移植（41 フィールド）
- スキーマ JSON 定義（sprout_interview_sheets.schema_json）
- 面接時の入力 UI（Tab 切替 / セクション分割）
- 評価入力（A/B/C/D/reject + コメント）
- 自動採点ロジック（任意項目）
- 過去の面接記録閲覧 UI

### 1.3 含めないもの

- Kintone データ自体の移行（過去案件は Kintone に残す前提）
- 面接動画録画（プライバシー上の課題、別検討）
- AI による面接所感生成（β版以降）

---

## 2. 設計方針 / 前提

- **構造移植**: Kintone のフィールド名・選択肢・必須/任意をそのまま再現
- **拡張容易性**: schema_json 駆動で UI 自動生成（41 フィールド以外への拡張も可能）
- **バージョニング**: sheet_name + version でテンプレ複数世代を保持
- **オフライン耐性**: iPad での運用想定、IndexedDB に下書き保存
- **電子署名**: 面接担当者の最終確定で signed_at + signed_by を記録

---

## 3. フィールド定義（41 フィールド構造）

### 3.1 セクション分割

| Section | 件数 | 内容 |
|---|---|---|
| 1. 基本情報 | 8 | 応募者氏名（読取専用、applicants から）/ 生年月日 / 性別 / 住所 / 連絡先 / 緊急連絡先 / 国籍 / 配偶者有無 |
| 2. 学歴・職歴 | 6 | 最終学歴 / 卒業年月 / 直近職歴 / 在籍期間 / 退職理由 / 経験職種 |
| 3. 希望条件 | 5 | 希望勤務地 / 希望職種 / 希望開始日 / 希望シフト / 希望時給 |
| 4. 通勤・勤務可能条件 | 4 | 通勤手段 / 通勤時間 / 勤務可能曜日 / 残業可否 |
| 5. 健康・特記事項 | 4 | 既往歴 / アレルギー / 障害手帳 / 特記事項 |
| 6. 動機・自己 PR | 4 | 応募経緯 / 志望動機 / 自己 PR / 入社後やりたいこと |
| 7. 面接時所感 | 6 | 第一印象 / 言葉遣い / 受答え / 服装 / 経験適合 / 性格適合 |
| 8. 評価 | 4 | 総合評価 A/B/C/D/reject / 推薦コメント / 推薦先部署 / 採用可否 |

合計 41 フィールド。

### 3.2 schema_json サンプル

```json
{
  "version": 1,
  "sections": [
    {
      "id": "basic",
      "title": "基本情報",
      "fields": [
        {"id": "applicant_name", "type": "readonly", "label": "氏名", "source": "applicant.full_name"},
        {"id": "birthday", "type": "date", "label": "生年月日", "required": true},
        {"id": "gender", "type": "select", "label": "性別", "options": ["male","female","other","no_answer"]},
        {"id": "nationality", "type": "text", "label": "国籍", "required": false},
        {"id": "marital_status", "type": "select", "label": "配偶者", "options": ["single","married","other"]}
      ]
    },
    {
      "id": "evaluation",
      "title": "評価",
      "fields": [
        {"id": "overall", "type": "select", "label": "総合評価", "options": ["A","B","C","D","reject"], "required": true},
        {"id": "recommendation", "type": "textarea", "label": "推薦コメント"},
        {"id": "recommend_dept", "type": "select", "label": "推薦先部署", "options_source": "fruit_companies_legal.departments"},
        {"id": "decision", "type": "radio", "label": "採用可否", "options": ["pass","conditional","reject"]}
      ]
    }
  ]
}
```

---

## 4. UI 仕様

### 4.1 入力画面

- ヘッダ: 応募者氏名 / 予約日時 / 面接担当者
- タブ: 8 セクション（モバイルは accordion）
- 各フィールド: schema_json 駆動で自動レンダリング（type ごとに対応コンポーネント）
- 下書き保存: IndexedDB（オフライン）+ 30 秒ごと自動保存
- 確定ボタン: 必須項目チェック → 確認モーダル → signed_at 記録

### 4.2 過去の面接記録閲覧

- 採用後も 3 年間保存（労働基準法第 109 条準拠 → 同期）
- applicant 詳細画面から 1 クリックで遷移
- 不採用者の記録は admin 以上のみ閲覧可

### 4.3 PDF 書き出し

- 確定後、PDF 書き出しボタン
- pdfjs-dist で生成、Storage に保存
- 採用面接の証跡として保管

---

## 5. 評価フロー

### 5.1 自動採点（任意項目）

- 第一印象 / 言葉遣い / 受答え / 服装 / 経験適合 / 性格適合 を 1〜5 段階入力（オプション）
- 平均 4.0 以上 → 「総合評価 A 候補」サジェスト
- あくまで参考表示、確定は面接担当者の判断

### 5.2 合格 → 内定発行

- decision='pass' → 内定登録ボタン表示 → S-07 のフローへ

### 5.3 不採用通知

- decision='reject' → 自動メール / LINE 送信ジョブ enqueue
- 文面テンプレ：丁寧かつ短く

---

## 6. データ移行（Kintone App 45）

- 既存案件の Kintone データは原則そのまま保持（Garden へは移行しない）
- ただしテンプレ自体（41 フィールド定義）は手動で schema_json に転記
- 確認: schema_json レビュー → 東海林さんと面接担当責任者の合意

---

## 7. 法令対応チェックリスト

- [ ] **個人情報保護法 第18条**: 利用目的（採用業務）を応募時に明示
- [ ] **個人情報保護法 第20条**: 安全管理措置（RLS 適用、不採用者は admin のみ閲覧）
- [ ] **労働基準法 第109条**: 労働者名簿は 3 年保存（不採用記録も同期間）
- [ ] **職業安定法 第5条の4**: 個人情報の収集制限（思想信条等の質問禁止）
- [ ] **男女雇用機会均等法**: 性別を理由とする不当判定の禁止 → schema にも判定基準として明記しない

---

## 8. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | Kintone App 45 のフィールド定義抽出 | 東海林さん / a-sprout | 0.25d |
| 2 | schema_json 設計 + sprout_interview_sheets 初期データ | a-sprout | 0.25d |
| 3 | スキーマ駆動 UI レンダラ実装 | a-sprout | 0.50d |
| 4 | 面接記録 CRUD + 署名ロジック | a-sprout | 0.25d |
| 5 | PDF 書き出し | a-sprout | 0.25d |

---

## 9. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 1 | Kintone のフィールド名翻訳（日本語 ID か英語 ID か） | 英語 ID + 日本語 label 案 |
| 2 | 自動採点の表示有無（バイアス懸念） | 当面は OFF、設定で ON 可 |
| 3 | 不採用記録の保存期間（3 年 vs 1 年） | 労基法準拠 3 年案 |
| 4 | 動画録画機能の必要性 | β版以降検討、α版は対象外 |
| 5 | テンプレ複数化（拠点別 / 職種別） | 法人別 + 職種別の組合せ案、判断保留 |
| 6 | 評価ランク（A/B/C/D/reject）の文言調整 | 既存運用準拠案 |

---

## 10. 既知のリスクと対策

- **リスク**: 不適切な質問項目
  - **対策**: 法令チェックリストでレビュー、職業安定法第 5 条の 4 違反を予防
- **リスク**: オフライン記録のロスト
  - **対策**: IndexedDB + 30 秒ごと自動保存、オンライン復帰時に強制同期

---

## 11. 関連ドキュメント

- `docs/specs/2026-04-25-garden-sprout-onboarding-redesign.md`
- `docs/specs/2026-04-26-sprout-S-01-migrations.md`
- `docs/specs/2026-04-26-sprout-S-03-interview-reservation-ui.md`
- `docs/specs/2026-04-26-sprout-S-07-account-issuance-flow.md`

---

## 12. 受入基準（Definition of Done）

- [ ] 41 フィールドが schema_json で定義され UI に正しく描画される
- [ ] iPad オフラインでの下書き保存・復帰が動作する
- [ ] 確定時の signed_at / signed_by が記録される
- [ ] 不採用者の記録が staff からは見えず admin のみ閲覧可
- [ ] PDF 書き出しが生成され Storage に保存される
- [ ] 法令チェックリスト 5 項目レビュー済
- [ ] §後述 Kintone 確定反映「シート待ち」DoD 全項目

---

## Kintone 確定反映: 決定 #13「シート待ち」= App 45 未提出待ち

> **改訂背景**: a-main 006 で東海林さんから 32 件の Kintone 解析判断が即決承認（`docs/decisions-kintone-batch-20260426-a-main-006.md`）。本セクションで決定 #13 を反映。

### 「シート待ち」の意味確定

- Kintone App 45 における「シート待ち」ステータス = **面接ヒアリングシート未提出**を待っている状態
- Garden 移植後も同義: **面接実施済だが sprout_interview_sheets が未確定（draft / submitted 前）**

### sprout_interview_sheets ステータス拡張

```sql
ALTER TABLE sprout_interview_sheets
  ADD COLUMN sheet_status text NOT NULL DEFAULT 'pending'
    CHECK (sheet_status IN (
      'pending',        -- 面接前 / シート未着手
      'in_progress',    -- 面接中 / 入力中
      'submitted',      -- 面接者が確定提出（admin レビュー待ち）
      'reviewed',       -- admin レビュー済
      'rejected'        -- 内容不備で再入力依頼
    )),
  ADD COLUMN submitted_at timestamptz,
  ADD COLUMN submitted_by uuid,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid;

CREATE INDEX idx_sprout_interview_sheets_pending
  ON sprout_interview_sheets (sheet_status, scheduled_at)
  WHERE sheet_status IN ('pending', 'in_progress');
```

### 「シート待ち」絞込

```sql
-- 面接実施済（scheduled_at < now()）かつシート未提出
SELECT
  s.id,
  s.applicant_id,
  a.name_kanji,
  s.scheduled_at,
  EXTRACT(epoch FROM (now() - s.scheduled_at)) / 86400 AS days_overdue
FROM sprout_interview_sheets s
JOIN sprout_applicants a ON s.applicant_id = a.id
WHERE s.scheduled_at < now()
  AND s.sheet_status IN ('pending', 'in_progress')
ORDER BY s.scheduled_at ASC;
```

### admin リマインダー Cron

```typescript
// /api/cron/sprout-sheet-pending-reminder (毎日 18:00 JST)
const overdue = await fetchOverdueSheets();  // scheduled_at + 24h 経過
for (const s of overdue) {
  await sendChatworkDMToInterviewer(s.interviewer_id, {
    message: `${s.applicant_name} さんの面接ヒアリングシート（${s.scheduled_at}）が未提出です。`,
  });
}
```

### S-01 §13.1 6 タブ UI との関係

- 6 タブ UI で「面接（interview）タブ」内に**シート未提出バッジ**を表示
- タブ滞留 24h 超の応募者を視覚識別

### 判断保留事項追加

| # | 論点 | a-auto スタンス |
|---|---|---|
| Sheet-1 | リマインダー閾値 | 面接終了から **24h** で初回、48h で 2 回目、72h で admin 通知 |
| Sheet-2 | 面接者退職時のシート移管 | admin が手動で別面接者に再割当可（操作ログ必須）|
| Sheet-3 | rejected → 再入力依頼の経路 | Chatwork DM + Sprout 内通知 |

### DoD 追加

- [ ] sprout_interview_sheets に sheet_status / submitted_at / reviewed_at 列追加
- [ ] 「シート待ち」絞込クエリが admin で動作
- [ ] 24h / 48h / 72h リマインダー Cron 動作
- [ ] 6 タブ UI のバッジ表示連動
