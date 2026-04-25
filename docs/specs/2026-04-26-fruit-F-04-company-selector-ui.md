# Fruit F-04: 共通法人セレクター UI（Sprout / Bud / Forest / Root 共有）

- 対象: Fruit 法人選択 UI（shared component、SWR キャッシュ、横断モジュール再利用）
- 優先度: 🔴
- 見積: **0.75d**
- 担当セッション: a-fruit（実装）/ a-root（連携）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Fruit F-04）
- 前提:
  - **F-01**（Migration）/ **F-02**（マッピング）/ **F-03**（取込スクリプト）
  - **Sprout v0.2 spec §13**（Fruit 連携、PR #76）— Sprout S-04/S-06/S-07 で本セレクター利用
  - **Cross History #04** 削除パターン統一規格

---

## 1. 目的とスコープ

### 1.1 目的
Garden の各モジュール（Sprout の雇用契約書テンプレ生成、Bud の振込元口座選択、Forest の法人別決算切替、Root の従業員所属法人指定）から共通利用できる**法人選択コンポーネント**を提供する。SWR キャッシュで API 呼び出しを最小化し、UX を統一する。

### 1.2 含めるもの
- `<FruitCompanySelector />` shared コンポーネント（select / combobox / radio の 3 バリアント）
- データ取得 API（`/api/fruit/companies`）+ SWR フック（`useFruitCompanies`）
- 法人詳細ポップオーバー（hover / click で法人番号・所在地・代表者を表示）
- フィルタ機能（法人格 / 拠点都道府県 / アクティブのみ）
- 並び順制御（company_code 昇順 / 商号カナ）
- 単一選択 / 複数選択モード
- 権限制御（staff 以上閲覧、admin / super_admin のみ書込）
- 取込ボタン（admin のみ表示、F-03 manual トリガ）

### 1.3 含めないもの
- 法人マスタ CRUD UI（管理画面、別 spec）
- 取込履歴 UI（import_runs 表示、別 spec）
- 法人詳細編集 UI（別 spec）

---

## 2. 設計方針 / 前提

- **shared 配置**: `src/components/fruit/` 配下、各モジュールから import
- **SWR キャッシュキー**: `/api/fruit/companies` 単一、TTL 5 分（取込頻度が日次なので十分）
- **アクセシビリティ**: aria-label / keyboard navigation / focus-visible 必須
- **i18n**: 日本語固定（v0.1 では英語対応せず）
- **デザイン**: Tailwind + shadcn-ui に統一、既存 Garden コンポーネントと同調
- **バンドルサイズ**: shared component は dynamic import 不要、軽量に保つ
- **型**: TypeScript strict、API レスポンスは zod でランタイム検証
- **モバイル対応**: Forest 以外は社内利用前提だが、最低限 sm: ブレークポイント対応

---

## 3. コンポーネント API

### 3.1 `<FruitCompanySelector />`

```tsx
type Props = {
  variant?: 'select' | 'combobox' | 'radio';
  value: string | string[];               // company_id (uuid) または配列
  onChange: (value: string | string[]) => void;
  multiple?: boolean;                     // multi 選択
  filter?: {
    corporateForm?: CorporateForm[];
    prefecture?: string[];
    activeOnly?: boolean;                 // default true
  };
  sortBy?: 'company_code' | 'company_name_kana';
  showInvoiceNumber?: boolean;            // インボイス番号併記
  showCorporateNumber?: boolean;          // 法人番号併記
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  ariaLabel?: string;
};
```

### 3.2 使用例

#### Sprout（雇用契約書テンプレ）
```tsx
<FruitCompanySelector
  variant="select"
  value={contractCompanyId}
  onChange={setContractCompanyId}
  filter={{ activeOnly: true }}
  showInvoiceNumber
  required
  ariaLabel="雇用契約書発行元法人"
/>
```

#### Bud（振込元口座）
```tsx
<FruitCompanySelector
  variant="combobox"
  value={paymentCompanyId}
  onChange={setPaymentCompanyId}
  filter={{ activeOnly: true }}
  sortBy="company_code"
  ariaLabel="振込元法人"
/>
```

#### Forest（法人別決算切替）
```tsx
<FruitCompanySelector
  variant="radio"
  value={selectedFiscalCompanyId}
  onChange={setSelectedFiscalCompanyId}
  ariaLabel="決算対象法人"
/>
```

#### Root（従業員所属法人）
```tsx
<FruitCompanySelector
  variant="select"
  value={employeeCompanyId}
  onChange={setEmployeeCompanyId}
  filter={{ activeOnly: true }}
  ariaLabel="所属法人"
/>
```

---

## 4. API（GET /api/fruit/companies）

### 4.1 リクエスト
```
GET /api/fruit/companies?activeOnly=true&corporateForm=kabushiki,godo&sortBy=company_code
Authorization: Bearer <session>
```

### 4.2 レスポンス
```json
{
  "data": [
    {
      "id": "uuid",
      "company_code": "HYU",
      "company_name": "株式会社ヒュアラン",
      "company_name_kana": "カブシキガイシャヒュアラン",
      "corporate_number": "1234567890123",
      "invoice_number": "T1234567890123",
      "corporate_form": "kabushiki",
      "prefecture": "東京都",
      "city": "千代田区",
      "active": true,
      "fiscal_month_end": 3,
      "primary_business": "システム開発・運用"
    }
  ],
  "totalCount": 6,
  "fetchedAt": "2026-04-26T03:15:00.000Z"
}
```

### 4.3 権限
- staff / closer / cs / manager / admin / super_admin: 全件閲覧可
- toss: 不可（403）
- 未認証: 401

### 4.4 SWR キャッシュ戦略
- key: `['fruit', 'companies', filterHash]`
- TTL: 5 min
- revalidateOnFocus: false（取込頻度が低いため）
- mutate: F-03 取込完了時に手動 invalidate

---

## 5. UI バリアント詳細

### 5.1 select
- HTML `<select>` ベース、シンプル
- 表示: `[HYU] 株式会社ヒュアラン (T1234567890123)`
- 100 件未満なら全件表示で十分

### 5.2 combobox
- 入力 + サジェスト（cmdk ベース）
- 検索: company_code / company_name / company_name_kana / corporate_number 部分一致
- キーボード操作: ↑ ↓ Enter Esc
- スタイル: shadcn `<Command />` 準拠

### 5.3 radio
- ラジオボタン縦並び
- 6 法人想定なので全表示
- 詳細ポップオーバーで法人情報を確認

### 5.4 詳細ポップオーバー
- ホバー / クリックで表示
- 内容:
  - 法人番号
  - インボイス番号
  - 本店所在地
  - 代表者名
  - 設立日
  - 決算月
- aria-describedby で視覚障害者対応

---

## 6. 取込トリガ UI（admin のみ）

### 6.1 配置
- セレクターの近くに「マスタ取込」ボタンを admin / super_admin のみ表示
- クリック → `/fruit/import-runs` 画面に遷移、または in-place で confirm modal

### 6.2 確認モーダル
```
┌─────────────────────────────────┐
│ Fruit 法人マスタを Kintone から取込│
├─────────────────────────────────┤
│ ◯ ドライラン（差分プレビュー）   │
│ ◯ 本番取込（DB 更新）            │
├─────────────────────────────────┤
│           [キャンセル] [実行]   │
└─────────────────────────────────┘
```

### 6.3 実行後
- 完了通知（Toast）
- SWR mutate でセレクターを最新化
- 結果詳細は import_runs 画面へリンク

---

## 7. 法令対応チェックリスト

- [ ] **個人情報保護法**: API レスポンスに代表者生年月日や口座番号を含めない（最小限フィールド）
- [ ] **インボイス制度**: invoice_number 表示時、未登録法人は「未登録」と明示
- [ ] **会社法**: 商号 / 代表者 / 本店所在地が UI 上で確認可能
- [ ] **アクセシビリティ（JIS X 8341-3）**: aria-label / keyboard navigation 完備
- [ ] **派遣法**: license_type='haken' を持つ法人にバッジ表示（任意拡張）

---

## 8. パフォーマンス指標

- 初回 API 呼び出し: < 200ms（6 件想定、Supabase 直接）
- SWR キャッシュ命中時: < 10ms（クライアント memo）
- combobox 検索: < 50ms（クライアント側フィルタ）
- バンドルサイズ: < 15KB gzipped（cmdk + shadcn）

---

## 9. テスト

### 9.1 単体（Vitest）
- 各 variant のレンダリング
- onChange 呼び出し
- フィルタロジック
- 並び順
- 権限による取込ボタン表示制御

### 9.2 e2e（Playwright）
- Sprout S-04 で本セレクターから法人選択 → 契約書テンプレに法人情報反映
- Bud で振込元選択 → 口座 hint が表示
- Forest で決算法人切替 → URL クエリ更新
- Root で従業員所属法人選択 → 保存

### 9.3 アクセシビリティ
- axe-core でエラー 0
- キーボード操作のみで完結
- スクリーンリーダー読み上げ確認

---

## 10. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | API ルート `/api/fruit/companies` | a-fruit | 0.10d |
| 2 | useFruitCompanies SWR フック | a-fruit | 0.05d |
| 3 | `<FruitCompanySelector />` select variant | a-fruit | 0.10d |
| 4 | combobox variant（cmdk） | a-fruit | 0.15d |
| 5 | radio variant | a-fruit | 0.05d |
| 6 | 詳細ポップオーバー | a-fruit | 0.10d |
| 7 | 取込トリガモーダル | a-fruit | 0.10d |
| 8 | 各モジュールでの使用例（Sprout / Bud / Forest / Root） | a-root + a-fruit | 0.10d |
| 9 | テスト（単体 + e2e + a11y） | a-fruit | 0.10d |

---

## 11. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| F04-1 | combobox 検索を server-side にするか client-side にするか | client-side（6 法人なので） |
| F04-2 | 詳細ポップオーバーの hover / click 起動方式 | hover + click 両対応（mobile は click のみ） |
| F04-3 | バリアント数を 3 にするか select/combobox の 2 にするか | 3（radio は Forest の決算切替で必要） |
| F04-4 | 取込ボタンをセレクター内に配置するか別画面にするか | セレクター近接（admin only）+ 別画面で詳細履歴 |
| F04-5 | 多言語対応（英語） | v0.1 不要、将来 i18n キー化検討 |

---

## 12. 既知のリスクと対策

- **キャッシュ不整合**: F-03 取込後 SWR mutate を呼ばないと古いデータ表示 → 取込完了 API レスポンスで mutate トリガ
- **権限ミス表示**: toss が誤って閲覧 → API 側で 403、UI 側でも feature flag
- **法人増加時のスケール**: 100 法人超えるなら server-side 検索に切替（v0.1 範囲外）
- **モジュール間の重複実装**: 各モジュールが独自に法人選択を作らないよう、CLAUDE.md / known-pitfalls で共通利用を周知

---

## 13. 関連ドキュメント

- F-01 / F-02 / F-03 / F-05
- Sprout v0.2 spec §13
- shared component 実装パターン: `src/components/root/RoleBadge.tsx` 等

---

## 14. 受入基準（Definition of Done）

- [ ] 3 バリアント（select / combobox / radio）が動作確認済
- [ ] SWR キャッシュが期待通り動作（5 min TTL、focus 時 re-validate なし）
- [ ] フィルタ・並び順が機能
- [ ] 詳細ポップオーバーが hover / click で表示
- [ ] admin のみ取込ボタン表示、staff には非表示
- [ ] Sprout / Bud / Forest / Root の 4 箇所で実使用例を実装
- [ ] 単体 / e2e / a11y テスト全合格
- [ ] バンドルサイズ < 15KB gzipped
- [ ] レビュー（a-bloom）完了
