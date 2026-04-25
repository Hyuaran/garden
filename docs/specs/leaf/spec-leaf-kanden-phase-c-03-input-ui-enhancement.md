# Leaf 関電業務委託 Phase C-03: 入力 UI 拡張（新規登録・添付・ショートカット）

- 対象: 新規案件登録フォーム、添付ファイル機能、1 click ステータス進行、FileMaker ショートカット踏襲
- 優先度: **🟡 高**
- 見積: **0.75d**
- 担当セッション: a-leaf
- 作成: 2026-04-24（a-auto / Batch 8 Leaf 関電 #03）
- 前提: C-01, C-02, Phase A-1c（添付ファイル）, Phase A-2（1 click ステータス）, Phase A-FMK1（FileMaker ショートカット）

---

## 1. 目的とスコープ

### 目的
事務担当と営業員が **FileMaker 11 と同等以上のスピード**で新規登録・編集・進行ができる入力 UI を完成させる。

### 含める
- 新規案件登録フォームの拡張
  - Phase A-1c の添付ファイル機能と連動
  - OCR 結果の自動入力
- 1 click ステータス進行 UI の拡張（Phase A-2 ベース）
- FileMaker キーボードショートカット踏襲（Phase A-FMK1 ベース）
- 入力補助（選択肢絞込、日付ピッカー、バリデーション即時）

### 含めない
- バックエンド（C-01 で定義済）
- 月次バッチ（C-04）
- Chatwork 通知（C-05）
- モバイル対応（Phase D）

---

## 2. 既存実装との関係

### Phase A / B 既存機能
| Phase | 機能 | C-03 での扱い |
|---|---|---|
| A-1c | 添付ファイルアップロード（Supabase Storage）| 新規フォームから呼出 |
| A-2 | 1 click ステータス進行ボタン | `StatusAdvanceBar` 拡張 |
| A-FMK1 | FileMaker 風ショートカット（Ctrl+N 等）| ショートカットマップを全画面展開 |
| B | `NewCaseModal` 新規登録 | **全面改修**（2 段階ウィザード化）|

### Phase C 新規コンポーネント

```
src/app/leaf/backoffice/_components/
  ├── NewCaseWizard.tsx           # 新規作成ウィザード（2 段階）
  ├── NewCaseStep1Basic.tsx       # Step 1: 基本情報 + 添付
  ├── NewCaseStep2Detail.tsx      # Step 2: 契約詳細・確認
  ├── FileMakerShortcutOverlay.tsx # ショートカット一覧オーバーレイ
  └── QuickStatusAdvance.tsx       # 1 click 進行ボタン（拡張版）
```

---

## 3. 新規登録ウィザード

### 3.1 2 段階構造

```
Step 1: 基本情報 + 添付
  ├─ 営業員選択 or 自分
  ├─ 顧客基本情報（名前・番号・住所）
  ├─ 添付ファイル（申込書スキャン、本人確認）
  └─ OCR 実行 → 結果をプレビュー（手動で承認）
       ↓
Step 2: 契約詳細
  ├─ 契約種別（低圧/高圧/特別高圧）
  ├─ プラン選択（soil_kanden_plans から）
  ├─ 供給地点番号（OCR 結果を初期値）
  ├─ 契約電力・想定使用量
  ├─ 検針日
  └─ メモ・備考
       ↓
確認 → 保存（status='ordered'）
```

### 3.2 Step 1: 基本情報 + 添付

```
┌─ 新規案件登録（1/2） ───────────────────────┐
│                                              │
│ ステップ 1: 基本情報                         │
│                                              │
│ 営業員 * [ 田中太郎（自分）▼ ]               │
│         └ 管理者は他の営業員を選択可         │
│                                              │
│ 案件種別 * ○ 最新  ○ リプレース  ○ 巻き直し │
│            ○ 社外                           │
│                                              │
│ 獲得種別 * ○ 奪還  ○ 囲い込み                │
│                                              │
│ 顧客番号 * [__________]                      │
│ 顧客名          [____________________]      │
│                                              │
│ ┌─ 添付ファイル ───────────────────┐       │
│ │ 📎 申込書.pdf (2.1MB) ✅ OCR 完了  │       │
│ │    ├ 自動抽出: 顧客番号 123456789 │       │
│ │    ├ 自動抽出: 供給地点 060-XX... │       │
│ │    └ 信頼度: 92%                  │       │
│ │ [+ 添付追加]                       │       │
│ └────────────────────────────────────┘       │
│                                              │
│ [キャンセル]  [次へ →]                        │
└──────────────────────────────────────────────┘
```

### 3.3 Step 2: 契約詳細

```
┌─ 新規案件登録（2/2） ──────────────────────┐
│                                              │
│ ステップ 2: 契約詳細                         │
│                                              │
│ 契約種別 * ○ 低圧  ● 高圧  ○ 特別高圧       │
│                                              │
│ プラン [ HV-BIZ-1 高圧ビジネス 1  ▼ ]       │
│                                              │
│ 供給地点番号 [ 060-XX-XXXX-XXX ]              │
│   └ OCR 結果から取込（編集可）               │
│                                              │
│ 契約電力 [____] kW                           │
│ 月間想定使用量 [____] kWh                   │
│ 検針日 [ 15 ] 日                             │
│                                              │
│ 至急 SW  □ はい  [ S5 ]                     │
│ 直営案件  □ はい                             │
│ 諸元即時あり  □ はい                         │
│                                              │
│ 備考・連絡事項                                │
│ [__________________________________]         │
│                                              │
│ [← 戻る] [確認して登録]                      │
└──────────────────────────────────────────────┘
```

### 3.4 OCR 結果の自動入力

```typescript
// Step 1 で添付された申込書 → Phase A-1c の OCR Edge Function 呼出
const ocrResult = await analyzeApplicationForm({
  storagePath: uploadedPath,
});

// 結果を Step 2 の初期値にマージ
setFormValue('customer_number', ocrResult.customer_number ?? '');
setFormValue('supply_point_22', ocrResult.supply_point_22 ?? '');
setFormValue('contract_type', mapContractType(ocrResult.voltage_class));
```

OCR 信頼度別の扱い:
- 信頼度 ≥ 90%: 自動入力、緑色背景で表示
- 70% ≤ 信頼度 < 90%: 自動入力、黄色警告「要確認」
- 信頼度 < 70%: 入力しない、手動で入力要

---

## 4. 1 click ステータス進行

### 4.1 Phase A-2 からの拡張

既存の `StatusAdvanceBar.tsx` を拡張：

```tsx
<QuickStatusAdvance
  case={caseData}
  onAdvance={async (nextStatus) => {
    const res = await advanceStatus({ caseId, targetStatus: nextStatus });
    if (res.success) toast.success(`${nextStatus} へ進めました`);
    else toast.error(res.error);
  }}
  onRegress={async (prevStatus) => { /* 戻す */ }}
/>
```

### 4.2 バリデーション先行実行

進行ボタン押下 → **必須入力のチェック先行**：

```
[次へ進める]
  ↓ クリック
必須入力チェック（C-02 §6.2 準拠）:
  - awaiting_entry への進行 → 諸元回収日必須
  - awaiting_payment への進行 → 請求日・invoice_sent_date 必須
  ...

欠損あり → モーダルで補完入力 → 再進行
欠損なし → 即進行
```

### 4.3 一括進行（Phase C-02 からの連携）

一覧画面で複数選択 → 「次ステータスへ」一括実行時も、**混在チェック + バリデーション実施**。

---

## 5. FileMaker ショートカット

### 5.1 既存（Phase A-FMK1）を全画面展開

| ショートカット | アクション |
|---|---|
| `Ctrl + N` | 新規作成 |
| `Ctrl + F` | 検索フォーカス |
| `Ctrl + S` | 保存 |
| `Ctrl + Enter` | 次ステータスへ進行 |
| `Ctrl + Shift + Enter` | 前ステータスへ戻る |
| `Ctrl + E` | 編集モーダル開閉 |
| `Esc` | モーダル閉じる |
| `Ctrl + P` | 印刷（ブラウザ標準）|
| `Ctrl + ↑ / ↓` | 前/次の案件へ（詳細画面で）|
| `Ctrl + K` | コマンドパレット（Phase D 以降）|
| `?` | ショートカット一覧オーバーレイ |

### 5.2 オーバーレイ表示

`?` キーで表示：

```
┌─ キーボードショートカット ──────────┐
│                                      │
│ 検索・新規                            │
│   Ctrl+F  : 検索                     │
│   Ctrl+N  : 新規作成                 │
│                                      │
│ 編集・保存                            │
│   Ctrl+E  : 編集                     │
│   Ctrl+S  : 保存                     │
│   Esc     : キャンセル                │
│                                      │
│ ステータス                            │
│   Ctrl+Enter      : 次へ進める        │
│   Ctrl+Shift+Ent  : 戻す             │
│                                      │
│ 一覧操作                              │
│   ↑ / ↓   : 行選択                    │
│   Enter  : 詳細を開く                 │
│   Space  : チェック切替                │
│                                      │
│ [閉じる (Esc)]                       │
└──────────────────────────────────────┘
```

### 5.3 アクセシビリティとの両立

- ショートカットは **必ず代替 UI を併存**（ボタン/メニュー）
- スクリーンリーダー利用者のための `aria-keyshortcuts` 属性

---

## 6. 入力補助機能

### 6.1 選択肢の動的絞込

| フィールド | 絞込ロジック |
|---|---|
| プラン | `contract_type` に応じて `soil_kanden_plans` から絞込 |
| 営業員 | admin は全員、staff は自部署、sales は自分のみ |
| 顧客番号 | 既存顧客データ（将来の `soil_kanden_customers` 作成後）からオートコンプリート |

### 6.2 日付ピッカー統一

- `type="date"` ブラウザ標準（Firefox / Chrome / Safari で UI 異なるが許容）
- 将来的に `react-datepicker` 統一（Phase D 検討）
- 和暦対応は **Phase D**、現状は西暦のみ

### 6.3 インライン バリデーション

```tsx
<input
  value={customerNumber}
  onChange={e => {
    setValue(e.target.value);
    if (!/^\d{9,13}$/.test(e.target.value)) {
      setFieldError('customer_number', '顧客番号は 9-13 桁の数字で入力');
    }
  }}
/>
{errors.customer_number && <InlineError>{errors.customer_number}</InlineError>}
```

### 6.4 供給地点番号の特別処理

22 桁形式（`060-XX-XXXX-XXXX-XX-XXXXXX-X`）：
- 入力時に自動ハイフン挿入
- 先頭 3 桁「060」固定、自動補完
- 4-5 桁目が `supply_schedule_code` に自動抽出

```typescript
export function formatSupplyPoint(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 3) return digits;
  // 060-XX-XXXX-XXXX-XX-XXXXXX-X
  return [
    digits.slice(0, 3),
    digits.slice(3, 5),
    digits.slice(5, 9),
    digits.slice(9, 13),
    digits.slice(13, 15),
    digits.slice(15, 21),
    digits.slice(21, 22),
  ].filter(Boolean).join('-');
}
```

---

## 7. エラーハンドリング

| ケース | 表示 |
|---|---|
| 必須フィールド未入力 | inline エラー（フィールド直下）|
| OCR 失敗 | toast「OCR に失敗しました。手動で入力してください」、フォーム続行可 |
| 登録時の RLS 拒否 | modal「この操作は事務担当以上のみ可能です」|
| 添付ファイルサイズ超過 | inline エラー「10MB 以下のファイルを選択してください」|
| ネットワーク切断 | toast「オフラインです。接続後に再試行してください」、フォーム内容は保持 |

---

## 8. 実装ステップ

### W1: NewCaseWizard 2 段階化（0.3d）
- [ ] `NewCaseWizard` ラッパ + `NewCaseStep1Basic` / `NewCaseStep2Detail`
- [ ] Step 間の state 管理（React context or lift state）
- [ ] Step 1 → 2 のバリデーション（Step 1 で完結）

### W2: 添付ファイル連動（0.15d）
- [ ] Phase A-1c の添付機能を呼出、結果を wizard state に保持
- [ ] OCR 結果を Step 2 の初期値にマージ
- [ ] 信頼度別の UI（緑/黄/赤）

### W3: 1 click ステータス進行（0.1d）
- [ ] `QuickStatusAdvance` Phase A-2 を拡張
- [ ] バリデーション先行実行（不足時のモーダル補完）

### W4: ショートカット全画面展開（0.1d）
- [ ] `FileMakerShortcutOverlay` コンポーネント
- [ ] グローバル key listener（`?` でオーバーレイ、他は各画面でコンテキスト付き）

### W5: 入力補助（0.1d）
- [ ] 供給地点番号の自動フォーマット
- [ ] プラン選択の絞込
- [ ] インラインバリデーション

---

## 9. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | ウィザード Step 数（2 vs 3+）| **2 段階**、複雑化を避ける |
| 判2 | OCR 結果の自動承認 | 信頼度 90% 以上でも**確認ステップ必須**（誤取込リスク）|
| 判3 | ショートカット競合（ブラウザ標準との）| Ctrl+N は `e.preventDefault()` で上書き、Ctrl+P は併用可 |
| 判4 | モバイル対応 | **Phase D 以降**、Phase C はデスクトップ前提 |
| 判5 | 一時保存（下書き）機能 | Phase C では未実装、登録は 1 回で完結 |
| 判6 | 営業員の新規登録権限 | **cs 以上**で自分を担当者として登録可、toss/closer は登録不可 |
| 判7 | 供給開始日カレンダーの統合 | Phase D で `kanden_calendar` テーブル連携 |

---

## 10. 関連参照

- **C-01**: schema（本 Batch）
- **C-02**: Backoffice UI（本 Batch）
- **Phase A-1c**: 添付ファイル + OCR（既設）
- **Phase A-2**: 1 click ステータス（既設）
- **Phase A-FMK1**: FileMaker ショートカット（既設）
- **親 CLAUDE.md §6**: FileMaker 風 UX 仕様

— end of C-03 —
