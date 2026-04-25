# Leaf 関電業務委託 Phase C-02: Backoffice UI（事務担当者向け）

- 対象: `/leaf/backoffice` 一覧・検索・編集画面の拡張
- 優先度: **🔴 高**
- 見積: **1.0d**
- 担当セッション: a-leaf
- 作成: 2026-04-24（a-auto / Batch 8 Leaf 関電 #02）
- 前提: C-01（スキーマ migration）, Phase B 既存 `backoffice/page.tsx`

---

## 1. 目的とスコープ

### 目的
事務担当者が**8 ステータスの案件一覧を俯瞰 → 個別詳細遷移 → ステータス進行・編集**までを完結できる UI を Phase C で完成させる。**FileMaker 11 からの移行完了**を視野に、非技術者（事務員）の使いやすさを優先。

### 含める
- 一覧画面の拡張（検索・フィルタ・一括操作）
- 詳細画面の新設（`/leaf/backoffice/cases/[id]`）
- ステータス進行ボタン（1 click 次ステータスへ）
- 編集モーダル（列ごとの編集 UI）
- CSV エクスポート（月次集計用）
- **非技術者向け UX 文言**を全面適用

### 含めない
- 新規案件登録フォームの拡張（C-03）
- 月次バッチ処理（C-04）
- Chatwork 通知（C-05）
- OCR 連携（Phase A-1c 既存）

---

## 2. 既存実装との関係

### Phase B 既存（`feature/leaf-kanden-supabase-connect`）

| ファイル | 役割 | Phase C での扱い |
|---|---|---|
| `backoffice/page.tsx` | 一覧画面の骨格 | **拡張**: フィルタ追加、行アクション |
| `backoffice/_components/NewCaseModal.tsx` | 新規登録モーダル | 維持（C-03 で拡張）|
| `backoffice/_components/StatusAdvanceBar.tsx` | ステータス進行バー | **流用**、詳細画面にも配置 |
| `backoffice/_components/StatusBadge.tsx` | ステータス色分け | 維持 |
| `backoffice/_components/StatusFlow.tsx` | 8 ステータスの可視化 | **強化**、詳細画面でも表示 |
| `backoffice/_components/SupplyInline.tsx` | 供給地点インライン表示 | 維持 |
| `_lib/queries.ts` | Supabase クエリ | **拡張**: 検索・フィルタ API |

### Phase C 追加コンポーネント

| 新規ファイル | 役割 |
|---|---|
| `backoffice/cases/[id]/page.tsx` | 案件詳細画面 |
| `backoffice/_components/CaseFilterPanel.tsx` | 検索・フィルタパネル |
| `backoffice/_components/CaseEditModal.tsx` | 編集モーダル（列ごと） |
| `backoffice/_components/CaseActionMenu.tsx` | 行ごとの操作メニュー |
| `backoffice/_components/CsvExportButton.tsx` | CSV 出力ボタン |
| `backoffice/_components/CancellationModal.tsx` | 解約処理モーダル |

---

## 3. UI 設計

### 3.1 一覧画面 `/leaf/backoffice`

```
┌─ 関電業務委託 案件一覧 ─────────────────────────────────────┐
│                                                              │
│ ┌─ 検索 ──────────────────────────────────────────────────┐ │
│ │ [顧客名 or 番号]  [全ステータス ▼]  [2026/04 〜 ▼]    │ │
│ │ 営業 [ ▼ ]  契約種別 [ ▼ ]  [ 詳細検索 ]              │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ 一覧：1,234 件中 1-50 件表示 [表示件数 50 ▼] [CSV 出力]    │
│                                                              │
│ □ | 状態 | 受注日 | 顧客名 | 営業 | 契約種別 | 検針日 | ⋯ │
│ ─────────────────────────────────────────────────────── │
│ □ 📙 諸元  04/01  山田商店  田中  高圧   15日   [▼] │
│ □ 📗 請求 04/10  佐藤邸   鈴木  低圧   20日   [▼] │
│ □ 🟥 解約 04/15  高橋工業 田中  高圧   25日   [▼] │
│ ...                                                          │
│                                                              │
│ [一括: 次ステータスへ] [一括: CSV]                           │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 詳細画面 `/leaf/backoffice/cases/[id]`

```
┌─ 案件 K-20260401-0042 ─────────────────────────────────────┐
│                                                              │
│ [一覧に戻る]    [📋 コピー] [編集] [解約]                    │
│                                                              │
│ ┌─ ステータス ───────────────────────────────────────────┐ │
│ │ 受注 → 諸元 → エントリー → 送付 → 請求 → 入金 → 支払 → 完了 │ │
│ │         ●                                                 │ │
│ │ 現在: 諸元待ち（2026/04/05 〜）                          │ │
│ │ [次へ進める (→ エントリー待ち)]  [諸元戻り]              │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─ 顧客情報 ─────────────┐ ┌─ 契約詳細 ──────────────┐ │
│ │ 番号: 123456789         │ │ 契約種別: 高圧           │ │
│ │ 名前: 山田商店          │ │ プラン: HV-BIZ-1         │ │
│ │ 供給地点: 060-XX-...    │ │ 契約電力: 50 kW          │ │
│ │ 供給開始: 2026/06/15    │ │ 想定使用量: 3,500 kWh    │ │
│ └─────────────────────────┘ │ 検針日: 15 日             │ │
│                              └─────────────────────────┘ │
│                                                              │
│ ┌─ 請求・支払 ────────────┐ ┌─ 営業・メモ ─────────────┐ │
│ │ 請求日: 2026/05/10       │ │ 担当: 田中太郎           │ │
│ │ 入金予定: 2026/05/31     │ │ 部署: 第一営業部         │ │
│ │ 入金実績: —              │ │ app_code: ABC-1          │ │
│ │ 手数料率: 8.5%           │ │ 備考: 至急 SW 案件       │ │
│ │ 手数料金額: ¥ 420,000   │ └─────────────────────────┘ │
│ └──────────────────────────┘                              │
│                                                              │
│ ┌─ 添付ファイル ──────────────────────────────────────────┐ │
│ │ 📎 申込書スキャン.pdf (2.1MB)                             │ │
│ │ 📎 本人確認書類.jpg (0.8MB)                               │ │
│ │ [+ 添付追加]                                              │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─ 履歴・監査ログ（admin+）──────────────────────────────┐ │
│ │ 2026/04/20 10:30  受注 → 諸元待ち (田中太郎)               │ │
│ │ 2026/04/05 14:22  新規登録 (鈴木花子)                     │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 編集モーダル

```
┌─ 編集: 案件 K-20260401-0042 ──────┐
│                                    │
│ セクション [契約詳細 ▼]            │
│                                    │
│ 契約種別 [高圧 ▼]                  │
│ プラン [HV-BIZ-1 ▼]                │
│ 契約電力 [____] kW                 │
│ 月間想定使用量 [____] kWh         │
│ 検針日 [15] 日                     │
│                                    │
│ [キャンセル] [保存]                 │
└────────────────────────────────────┘
```

---

## 4. 非技術者向け UX 文言

### 4.1 ルール

- **英語カタカナは避ける**（「エントリ」「ステータス」は例外で許容、既に現場で定着）
- **「更新」「保存」は明示**（「適用」「反映」は使わない）
- **未入力時のヒントを具体化**（「必須」「例: 12345」）
- **エラーメッセージは次のアクションを提示**

### 4.2 対照表

| NG 文言 | OK 文言 |
|---|---|
| データが存在しません | データが見つかりませんでした |
| 操作を許可されていません | この操作は admin（経理担当）のみ可能です |
| バリデーションエラー | 入力内容を確認してください |
| 更新に失敗しました | 更新できませんでした。再試行してください |
| ローディング中... | 読み込み中です… |
| 削除しますか？ | この案件を削除します。取り消せません。続行しますか？ |
| OK / キャンセル | 実行する / やめる |

### 4.3 ステータス説明文（一覧画面でのツールチップ）

| ステータス | 説明文 |
|---|---|
| 受注 | 申込書を受け取り、登録が完了した状態 |
| 諸元待ち | お客様情報を確認中、追加資料を待っています |
| エントリー待ち | 関電へエントリーする準備中 |
| 送付待ち | 関電へ書類送付予定 |
| 請求待ち | 関電から請求書発行待ち |
| 入金待ち | お客様からの入金を待っています |
| 支払待ち | 営業員へ手数料を支払う予定 |
| 完了 | すべての工程が終了しました |

---

## 5. API / Server Action 契約

### 5.1 一覧取得

```typescript
export type CaseListFilter = {
  searchText?: string;             // 顧客名/番号の部分一致
  statuses?: KandenStatus[];       // OR 検索
  salesEmployeeNumber?: string;
  contractType?: string;
  orderedFrom?: string;            // YYYY-MM-DD
  orderedTo?: string;
  cancelledOnly?: boolean;
  page: number;
  limit: number;
};

export async function fetchCaseList(filter: CaseListFilter): Promise<{
  rows: KandenCase[];
  total: number;
  page: number;
}>;
```

### 5.2 詳細取得

```typescript
export async function fetchCaseDetail(caseId: string): Promise<{
  case: KandenCase;
  attachments: Attachment[];
  history: StatusHistoryEntry[];  // 監査ログから抽出
}>;
```

### 5.3 ステータス進行

```typescript
export async function advanceStatus(input: {
  caseId: string;
  targetStatus: KandenStatus;
  reason?: string;
  notes?: string;
}): Promise<
  | { success: true; newStatus: KandenStatus }
  | { success: false; error: string; code: string }
>;
```

### 5.4 案件編集

```typescript
export async function updateCase(input: {
  caseId: string;
  patch: Partial<Pick<KandenCase,
    'contract_type' | 'plan_code' | 'meter_reading_day' |
    'monthly_kwh' | 'contract_kw' | 'customer_tier' |
    'commission_rate' | 'commission_amount' | 'note' | 'review_note'
  >>;
}): Promise<{ success: boolean; error?: string }>;
```

### 5.5 解約処理

```typescript
export async function cancelCase(input: {
  caseId: string;
  reason: string;                 // 10 文字以上必須
  effectiveDate?: string;
}): Promise<{ success: boolean; error?: string }>;
```

### 5.6 CSV エクスポート

```typescript
export async function exportCasesCsv(filter: CaseListFilter): Promise<{
  signedUrl: string;
  fileName: string;
  expiresAt: string;              // 10 分有効
}>;
```

---

## 6. ステータス遷移フロー

### 6.1 遷移ルール（C-01 schema 準拠）

```
ordered → awaiting_specs → awaiting_entry → awaiting_sending
         → awaiting_invoice → awaiting_payment → awaiting_payout
         → completed

任意の時点で cancellation_flag=true への遷移可（別フロー）
```

**ロール別の遷移可能性**:
- 営業（cs 以上）: 受注 → 諸元（ordered → awaiting_specs）のみ
- 事務（staff 以上）: **全遷移**
- admin: 全遷移 + 解約 + 削除（cancelled 後のみ）

### 6.2 バリデーション

| ステータス | 進行前チェック |
|---|---|
| awaiting_specs | 受注日設定済 |
| awaiting_entry | **諸元回収日**必須 |
| awaiting_sending | **エントリー日**必須、PD 番号 入力済 |
| awaiting_invoice | **送付日**必須 |
| awaiting_payment | **請求日**必須、invoice_sent_date 必須 |
| awaiting_payout | **入金実績日** 必須、commission_amount 計算済 |
| completed | **支払実績日** 必須 |
| canceled | **reason** 必須（10 文字以上）|

---

## 7. 一括操作

### 7.1 一括ステータス進行

- チェックボックスで複数選択
- 対象案件の**現ステータスがすべて同じ**場合のみ「次ステータスへ」一括実行
- 混在時はエラー（個別処理を促す）

### 7.2 一括 CSV エクスポート

- 選択案件のみ出力
- フィルタ状態の全件も選択可（「すべて選択（ページ外含む）」ボタン）
- 最大 10,000 件/回（超過時は 2 回に分ける）

### 7.3 一括制限

- **一括解約は禁止**（誤操作リスク）、個別処理のみ
- 一括削除も禁止（super_admin でも不可）

---

## 8. 監査ログ連携（spec-cross-audit-log 準拠）

| 操作 | severity | action |
|---|---|---|
| 案件詳細を開く | - | 記録なし（閲覧頻度高、不要）|
| ステータス進行 | info | `leaf.case_advance` |
| 一括ステータス進行 | info | `leaf.case_batch_advance` |
| 編集 | info | `leaf.case_update` |
| 解約 | **warn** | `leaf.case_cancel` |
| CSV 出力 | info | `leaf.case_export_csv` |

---

## 9. エラーハンドリング（spec-cross-error-handling 準拠）

| ケース | 表示 |
|---|---|
| ステータス進行失敗（業務ルール違反）| toast エラー「諸元回収日を入力してください」|
| RLS 拒否 | modal「この操作は事務担当のみ可能です」|
| 一括操作で一部失敗 | toast「5 件成功、2 件失敗」+ 失敗案件リスト表示 |
| CSV 生成タイムアウト | toast「時間がかかっています。しばらくお待ちください」|

---

## 10. アクセシビリティ

- 一覧テーブル: `<caption>` + `<th scope="col">`
- ステータスバッジ: `aria-label` で状態明示
- 詳細画面のセクション: `<section>` + `aria-labelledby`
- 編集モーダル: focus trap、Esc で閉じる
- キーボード操作: 一覧行を Enter で詳細へ

---

## 11. 実装ステップ

### W1: 一覧画面拡張（0.3d）
- [ ] `CaseFilterPanel` 新規作成
- [ ] ページネーション + 全件数表示
- [ ] 一括操作チェックボックス + アクションバー
- [ ] CSV エクスポートボタン

### W2: 詳細画面（0.4d）
- [ ] `/leaf/backoffice/cases/[id]/page.tsx` 新規作成
- [ ] セクション構造（顧客情報・契約詳細・請求支払・営業メモ・添付・履歴）
- [ ] ステータス進行バー（`StatusAdvanceBar` 流用）
- [ ] 「次へ進める」「戻す」ボタン
- [ ] 監査ログタブ（admin+ のみ表示）

### W3: 編集モーダル（0.15d）
- [ ] `CaseEditModal` セクション別編集
- [ ] バリデーション（Zod）
- [ ] Server Action `updateCase`

### W4: 解約処理（0.1d）
- [ ] `CancellationModal` 理由入力（10 文字以上）
- [ ] 確認ダイアログ（取り消し不可を明示）
- [ ] `cancelCase` Server Action

### W5: 文言調整・動作確認（0.05d）
- [ ] 非技術者向け文言チェック（§4.2 対照表準拠）
- [ ] 実データで動作確認（Phase B の既存案件 100 件超）

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | 一覧画面のデフォルト表示件数 | **50 件**（スクロール負荷と情報密度のバランス）|
| 判2 | フィルタ状態の URL 同期 | **同期する**（ブラウザバック・共有リンクで便利）|
| 判3 | 詳細画面の監査ログタブ | **admin+ のみ**（営業・事務には不要）|
| 判4 | 一括ステータス進行の件数上限 | **100 件/回**（トランザクション肥大化防止）|
| 判5 | 解約後の詳細画面アクセス | 閲覧可（履歴確認のため）、編集不可 |
| 判6 | 営業員の一覧閲覧範囲 | 自分の案件のみ（RLS）、全員閲覧は Phase D |
| 判7 | CSV の文字コード | **UTF-8 with BOM**（Excel 互換性） |
| 判8 | 長文 note の表示 | 一覧では 30 字で切って tooltip、詳細画面で全文 |

---

## 13. 関連参照

- **C-01 schema migration**（本 Batch）
- **Phase B 既存**: `feature/leaf-kanden-supabase-connect` の backoffice/
- **spec-cross-error-handling §4**: toast/modal 使い分け
- **spec-cross-audit-log §4**: 必須記録一覧
- **親 CLAUDE.md §6**: FileMaker 風 UX

— end of C-02 —
