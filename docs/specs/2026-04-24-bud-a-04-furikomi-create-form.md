# Bud A-04: 振込新規作成フォーム 設計書

- 対象: Garden-Bud 振込管理の新規作成画面 UI + サーバ契約
- 見積: **0.5d**（約 4 時間）
- 担当セッション: a-bud
- 作成: 2026-04-24（a-auto / Phase A 先行 batch5 #A-04）
- 前提 spec: Bud A-03（6 段階遷移）

---

## 1. 目的とスコープ

### 目的
事務担当が振込依頼を Garden-Bud に登録する**新規作成フォーム**の仕様を定める。Phase 0 で `transfers/page.tsx` にリンクだけ存在する `new-regular` / `new-cashback` を実体化。

### 含める
- `/bud/transfers/new-regular` ページ（通常振込）
- `/bud/transfers/new-cashback` ページ（キャッシュバック、Leaf 連携想定）
- 3 種のデータソース（紙スキャン / デジタル入力 / CSV インポート）
- Root マスタ参照（法人 / 銀行口座 / 取引先）
- バリデーション + 重複検出（Phase 0 `_lib/duplicate-key.ts` 活用）
- 保存 = `status='下書き'` で INSERT

### 含めない
- 承認フロー UI（A-05 で別 spec）
- ステータス変更ボタン（A-05）
- CSV エクスポート（別タスク）
- 明細照合（A-06）

---

## 2. 既存実装との関係

### Phase 0 成果物
| ファイル | 役割 | 本 spec との関係 |
|---|---|---|
| `transfers/page.tsx` | 一覧（+ 「+ 通常振込」「+ キャッシュバック」ボタン）| リンク先ページを実装 |
| `transfers/_lib/transfer-form-schema.ts` | Zod スキーマ想定 | 本 spec でフィールド定義を詰める |
| `_lib/transfer-mutations.ts` | `createTransfer()` 等 | 本 spec の Server Action 呼出元 |
| `_lib/duplicate-key.ts` | 重複検出キー生成（DB 側と同ロジック）| 送信前に検出 |
| `_lib/transfer-id.ts` | FK-/CB- ID 生成 | DB が自動生成する想定、フロントでは不要 |
| `_state/BudStateContext.tsx` | sessionUser 参照 | 起票者 user_id 取得 |

### 重複排除
- ID 生成はフロントでしない（DB trigger で自動採番）
- 法人・銀行口座・取引先マスタの選択肢は Root クエリ（キャッシュは BudStateContext）

---

## 3. UI ワイヤ

### 3.1 `/bud/transfers/new-regular`（通常振込）

```
┌─ 新規振込依頼（通常）────────────────────────────┐
│                                                   │
│ ┌─ データソース ─────────────┐                    │
│ │ ○ 紙スキャン  ● デジタル入力  ○ CSV インポート │
│ └────────────────────────────┘                    │
│                                                   │
│ ┌─ 基本情報 ────────────────────────────────────┐ │
│ │ 振込種別 *  [▼ 給与 / 外注費 / 経費 / その他] │ │
│ │ 起票法人 *  [▼ 株式会社ヒュアラン…]           │ │
│ │ 支払元口座 * [▼ 楽天銀行 第一営業支店 1234567]│ │
│ └──────────────────────────────────────────────┘ │
│                                                   │
│ ┌─ 振込先 ───────────────────────────────────┐   │
│ │ 取引先 *    [▼ 株式会社タイニー …] + 新規追加│  │
│ │   └─ 選択時、口座情報を自動入力            │   │
│ │ 振込金額 *  [___________] 円              │   │
│ │ 手数料負担  [○ 当方 ● 先方]                │   │
│ └────────────────────────────────────────────┘   │
│                                                   │
│ ┌─ 日付 ────────────────────────────────────┐   │
│ │ 依頼日     [2026-04-24]（自動）            │   │
│ │ 支払期日   [📅 2026-05-10]（任意）         │   │
│ │ 振込予定日 [📅 2026-05-08] *              │   │
│ └────────────────────────────────────────────┘   │
│                                                   │
│ ┌─ 添付・備考 ───────────────────────────────┐   │
│ │ 請求書スキャン [📎 file_upload.pdf 選択済]  │   │
│ │ 備考 [                                    ] │   │
│ └────────────────────────────────────────────┘   │
│                                                   │
│ ⚠️ 重複候補: 同日・同金額・同取引先が 1 件あります │
│                                                   │
│ [キャンセル] [下書き保存] [確認済みとして保存]      │
└───────────────────────────────────────────────────┘
```

### 3.2 `/bud/transfers/new-cashback`（キャッシュバック）

通常と違う点:
- **取引先選択の代わりに「顧客」**: Leaf 案件から引き継がれる連絡先情報（氏名 + 銀行口座）を入力
- **起票法人の代わりに「販売法人」**: どの法人の CB か
- **金額は Leaf 側で確定した CB 額**を持ち込み（Phase 1c で連携、Phase 0 では手入力）
- データソースに「Leaf 連携」オプション（Phase 1c で追加、本 spec では保留 判6）

---

## 4. データモデル提案

### 4.1 既存 `bud_transfers` テーブル（Phase 0）
本 spec では**カラム追加のみ**、テーブル自体は維持：

```sql
-- 追加提案（既存カラムとの重複確認要）
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS attachment_url text,           -- 請求書スキャン等
  ADD COLUMN IF NOT EXISTS attachment_storage_path text,  -- Supabase Storage パス
  ADD COLUMN IF NOT EXISTS notes text,                    -- 備考
  ADD COLUMN IF NOT EXISTS duplicate_check_key text,      -- 重複検出キー（Phase 0 で既存？要確認）
  ADD COLUMN IF NOT EXISTS created_by_note text;          -- 起票メモ（differs from notes）
```

### 4.2 Storage bucket
```sql
-- 請求書スキャンの格納
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bud-attachments', 'bud-attachments', false, 10485760,  -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- RLS: staff+ で upload、bud_users 全員が自社分のみ read
CREATE POLICY ba_read ON storage.objects FOR SELECT
  USING (bucket_id = 'bud-attachments' AND bud_is_user());

CREATE POLICY ba_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bud-attachments' AND bud_has_role('staff'));
```

---

## 5. API / Server Action 契約

### 5.1 `createTransfer(params)`
```typescript
export async function createTransfer(params: {
  category: 'regular' | 'cashback';
  transferType: TransferType;
  dataSource: DataSource;
  sourceCompanyId: string;      // 起票法人
  sourceAccountId: string;      // 支払元口座（root_bank_accounts）
  vendorId?: string;            // regular の場合
  customerName?: string;        // cashback の場合、Leaf から持込む顧客名
  customerBankInfo?: {          // cashback 時、取引先マスタに登録されていない人へ振込
    bankName: string;
    bankCode: string;
    branchName: string;
    branchCode: string;
    accountType: '普通' | '当座';
    accountNumber: string;
    accountHolderKana: string;
  };
  amount: number;
  feeBearer: FeeBearer;
  dueDate?: string;              // 支払期日（YYYY-MM-DD）
  scheduledDate: string;         // 振込予定日
  attachmentFile?: File;         // 請求書スキャン
  notes?: string;
  saveAsConfirmed?: boolean;     // true なら 下書き → 確認済み まで進める
}): Promise<
  | { success: true; transferId: string; status: TransferStatus }
  | { success: false; error: string; code: CreateTransferErrorCode }
>;

export type CreateTransferErrorCode =
  | 'UNAUTHORIZED' | 'FORBIDDEN'
  | 'INVALID_INPUT' | 'DUPLICATE_SUSPECTED'
  | 'ATTACHMENT_UPLOAD_FAILED' | 'DB_ERROR';
```

### 5.2 重複検出
```typescript
// Phase 0 既存 _lib/duplicate-key.ts を活用
import { buildDuplicateKey } from '../_lib/duplicate-key';

const key = buildDuplicateKey({
  sourceCompanyId, vendorId, amount, scheduledDate
});

// DB に同 key が status != '振込完了' で存在したら DUPLICATE_SUSPECTED を返す
const { data: dupes } = await supabase
  .from('bud_transfers')
  .select('id')
  .eq('duplicate_check_key', key)
  .neq('status', '振込完了');

if (dupes && dupes.length > 0) {
  return { success: false, error: '同条件の振込が存在します', code: 'DUPLICATE_SUSPECTED' };
}
```

**UI 側の扱い**: DUPLICATE_SUSPECTED は**警告**でありブロックではない。ユーザーが「承知の上で登録」ボタンで強制登録可（`force=true` フラグで再送）。

### 5.3 添付ファイルアップロード
1. Supabase Storage `bud-attachments/{transfer_id}/{timestamp}_{fileName}` に upload
2. 成功した storage_path を `bud_transfers.attachment_storage_path` に保存
3. INSERT 失敗時は Storage からも `.remove()`（ロールバック）

---

## 6. 状態遷移

本 spec は「下書き作成のみ」が主。A-03 準拠で：
- 保存（下書き）: status = '下書き'
- 確認済みとして保存: status = '確認済み'（staff 自身が内容確認済の意思表示）

遷移は A-03 の `TRANSFER_STATUS_TRANSITIONS` 通り。本 spec は新規作成だけのため INSERT のみ。

---

## 7. Chatwork 通知

- **新規下書き作成**: 通知なし（個人作業段階）
- **「確認済みとして保存」**: 一覧で「確認済み」が出るのみ（Chatwork 通知は A-05 承認依頼で発火）

---

## 8. 監査ログ要件

- 新規 INSERT は `bud_transfer_status_history` に 1 行（from_status=NULL, to_status='下書き' or '確認済み'）
- 添付ファイルアップロード成否は `console.log` のみ（ファイル名は PII 含む可能性、ログ記録は別判断）

---

## 9. バリデーション規則

| # | フィールド | ルール |
|---|---|---|
| V1 | transferType | 必須、enum 値 |
| V2 | sourceCompanyId | 必須、`root_companies` に存在 |
| V3 | sourceAccountId | 必須、`root_bank_accounts` で sourceCompanyId と紐付く |
| V4 | vendorId（regular のみ）| 必須、`root_vendors` に存在 |
| V5 | customerName（cashback のみ）| 必須、1 文字以上 |
| V6 | customerBankInfo（cashback のみ）| 完全入力 OR vendorId のいずれか必須 |
| V7 | amount | 必須、1 以上、整数、上限 99,999,999（法人振込の実務上限） |
| V8 | scheduledDate | 必須、YYYY-MM-DD、**翌営業日以降**（当日振込はネットバンキングで別扱い）|
| V9 | dueDate | 任意、YYYY-MM-DD、scheduledDate 以降 |
| V10 | attachmentFile | 任意、10MB 以下、PDF/JPG/PNG |
| V11 | notes | 任意、500 字以下 |

---

## 10. 受入基準

1. ✅ `/bud/transfers/new-regular` と `/bud/transfers/new-cashback` の 2 ページが動作
2. ✅ データソース 3 種（紙スキャン / デジタル入力 / CSV インポート）の選択が反映
3. ✅ 法人選択で支払元口座が自動絞り込み（`root_bank_accounts.company_id` フィルタ）
4. ✅ 取引先選択で銀行情報が自動入力（`root_vendors` から）
5. ✅ 新規取引先の追加はモーダル経由で Root マスタに登録（別タスクの開発後）
6. ✅ 重複検出（同条件の未完了振込が存在）で警告表示、強制登録可
7. ✅ 請求書スキャン（PDF/JPG/PNG）が Storage に保存される
8. ✅ 「下書き保存」で `status='下書き'`、「確認済み」で `status='確認済み'` で INSERT
9. ✅ 作成後は `/bud/transfers` 一覧に戻り、新規行が先頭表示
10. ✅ §9 バリデーション全項目がサーバサイドで検証される

---

## 11. 想定工数（内訳）

| # | 作業 | 工数 |
|---|---|---|
| W1 | new-regular ページ + フォーム | 0.15d |
| W2 | new-cashback ページ（customer 情報拡張） | 0.1d |
| W3 | 取引先選択モーダル + 新規追加（Root 側の UI 連携） | 0.1d |
| W4 | 添付ファイルアップロード処理 | 0.05d |
| W5 | `createTransfer` Server Action + 重複検出 | 0.05d |
| W6 | Zod スキーマ（Phase 0 既存を流用・拡張）| 0.05d |
| **合計** | | **0.5d** |

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | 新規取引先の追加 UI 位置（Bud 内 or Root 画面へ遷移）| **Bud 内モーダル推奨**（離脱防止）、Root へ INSERT する RLS を admin+ で許可 |
| 判2 | 当日振込の扱い | **翌営業日以降のみ許可**、当日は admin 判断で個別対応（ネットバンキング側）|
| 判3 | CSV インポート形式 | Kintone 風（項目名/振込先/金額）で別 spec、本 spec では選択肢のみ設置 |
| 判4 | 紙スキャン OCR 自動入力 | **対応しない**、手入力運用 |
| 判5 | cashback の customerBankInfo 一時保存 | 取引先マスタに登録せず `bud_transfers` 内カラムで完結（vendor 依存を解除）|
| 判6 | cashback の Leaf 連携（Phase 1c） | 本 spec は手入力、Leaf 連携は別 spec（Phase 1c）|
| 判7 | 添付ファイル複数対応 | Phase A は 1 ファイル、複数は Phase B（子テーブル化）|
| 判8 | 「確認済みとして保存」の可否判定 | データソース='デジタル入力' のみで許可、紙スキャン/CSV は一旦下書き必須 |

— end of A-04 spec —
