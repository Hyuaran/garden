# Leaf 関電業務委託 Phase C-06: テスト戦略（Leaf 厳格度 🟡）

- 対象: Phase C 全機能（C-01 〜 C-05）のテスト計画
- 優先度: **🟡 中**
- 見積: **0.75d**（テストコード作成含む）
- 担当セッション: a-leaf
- 作成: 2026-04-24（a-auto / Batch 8 Leaf 関電 #06）
- 前提: spec-cross-test-strategy（Batch 7）, 親 CLAUDE.md §16 7 種テスト, §17 3 段階展開

---

## 1. 目的とスコープ

### 目的
Leaf 関電業務委託 Phase C の**現場投入前に**、**§16 7 種テストを Leaf 厳格度 🟡（通常）**で完走させる。MF11 からの移行プロジェクトとして、データ整合性と UX 継続性を優先。

### 含める
- Vitest（単体、`_lib/` と純関数）
- RTL + MSW（統合、Client Component × Supabase）
- Playwright（E2E、主要フロー 5 本）
- §16 7 種テストの各項目カバー
- α版 → β版（3-5 人）→ リリース版 の 3 段階検証計画

### 含めない
- テスト自動修復ツール（Phase D）
- Visual Regression（Phase D）
- 負荷テスト（別途、Phase C 終盤に個別検討）

---

## 2. Leaf 厳格度の設定

### 2.1 spec-cross-test-strategy 準拠の位置付け

| モジュール | 厳格度 |
|---|---|
| Tree / Bud / Root | 🔴 最厳格 |
| **Leaf** | **🟡 通常** |
| Forest / Bloom | 🟡 通常 |
| Soil / Rill / Seed | 🟢 標準 |

### 2.2 Leaf 🟡 通常のカバレッジ目標

| レイヤ | 対象 | 目標 |
|---|---|---|
| Unit（Vitest） | `src/app/leaf/_lib/` + `_constants/` + 計算ロジック | **70%** |
| Integration（RTL+MSW）| 主要 Component × Supabase | **50%** |
| E2E（Playwright）| 主要 5 フロー | **5 本**のスモーク |

Tree/Bud/Root の 🔴 より緩く、Soil/Rill の 🟢 より厳しい中間位置。

---

## 3. §16 7 種テストとの接続

spec-cross-test-strategy §3 のマトリクスを Leaf 具体的ケースに落とす：

### 3.1 機能網羅テスト（Integration + E2E）

| 対象 | レイヤ | ケース数 |
|---|---|---|
| 8 ステータス × 進行ボタン | E2E | 8 種 |
| 新規登録ウィザード Step 1/2 | Integration | 10 種 |
| 編集モーダル セクション別 | Integration | 6 種 |
| 解約モーダル | Integration | 3 種 |
| CSV エクスポート | E2E | 2 種（単件/一括）|

### 3.2 エッジケーステスト（Unit + Integration）

**特に重要**（判4 → Leaf 🟡 エッジ優先）:

```typescript
describe('Leaf エッジケース', () => {
  // 空入力
  it('顧客名 空欄で登録 → inline エラー', async () => { /* ... */ });

  // 極大入力
  it('備考 1000 文字で登録 → スクロール表示', async () => { /* ... */ });
  it('顧客名 255 文字で登録 → 保存成功 + truncate 表示', async () => { /* ... */ });

  // 特殊文字
  it('顧客名 "山田 & Co., Ltd."（アンパサンド、カンマ、ピリオド）', async () => { /* ... */ });
  it('絵文字 🏢 を含む顧客名', async () => { /* ... */ });
  it('全角半角混在の顧客番号 "123４５６" → 全角を半角変換', async () => { /* ... */ });

  // マルチバイト
  it('中国語簡体字 "顾客信息"', async () => { /* ... */ });
  it('韓国語 "고객 정보"', async () => { /* ... */ });

  // 日付境界
  it('うるう年 2024-02-29', async () => { /* ... */ });
  it('月末 2026-01-31 → 2 月は 28/29 日', async () => { /* ... */ });
  it('年跨ぎ 2025-12-31 → 2026-01-01', async () => { /* ... */ });

  // 金額境界
  it('手数料 0 円 → 警告のみ、登録可', async () => { /* ... */ });
  it('手数料 1 兆円（ビッグインディ値）', async () => { /* ... */ });

  // ステータス境界
  it('completed から awaiting_specs へ戻す → 禁止', async () => { /* ... */ });
  it('cancellation_flag=true の案件のステータス変更 → 禁止', async () => { /* ... */ });
});
```

### 3.3 権限テスト（Integration + E2E）

```typescript
describe('Leaf 権限', () => {
  // ロール別のアクセス
  it('toss: 自分の案件のみ表示', async () => { /* ... */ });
  it('toss: 他人の案件詳細 404', async () => { /* ... */ });
  it('cs: 自分の案件は編集可、ステータス進行は不可', async () => { /* ... */ });
  it('staff: 全案件表示 + ステータス進行可', async () => { /* ... */ });
  it('admin: 全操作可 + 解約可', async () => { /* ... */ });
  it('super_admin: 削除可（cancelled のみ）', async () => { /* ... */ });

  // RLS
  it('未認証で /leaf/backoffice → /leaf/login にリダイレクト', async () => { /* ... */ });
  it('forest_user だが leaf_user でないユーザー → 403', async () => { /* ... */ });
});
```

### 3.4 データ境界テスト（Unit）

```typescript
describe('Leaf データ境界', () => {
  it('NULL 値: customer_name null で一覧表示 → "—" フォールバック', async () => { /* ... */ });
  it('負数: monthly_kwh -100 → 保存時 Zod エラー', async () => { /* ... */ });
  it('最大長: 備考 テキスト 10000 文字', async () => { /* ... */ });
  it('日付境界: 検針日 31 + 2 月 → 月末扱い', async () => { /* ... */ });
  it('契約電力 0 kW → Zod エラー', async () => { /* ... */ });
  it('未来の受注日 2030-01-01 → 警告だが許容', async () => { /* ... */ });
});
```

### 3.5 パフォーマンステスト（E2E）

```typescript
test('Leaf パフォーマンス', async ({ page }) => {
  // 一覧画面
  await page.goto('/leaf/backoffice');
  await page.waitForLoadState('networkidle');
  // 1,000 件の案件を表示しても 3 秒以内
  const start = Date.now();
  await page.fill('[name="search"]', '山田');
  await page.waitForTimeout(500);  // debounce
  await page.waitForSelector('[data-testid="case-row"]');
  expect(Date.now() - start).toBeLessThan(3000);

  // 月次レポート生成
  await page.goto('/leaf/backoffice/monthly-reports/generate');
  // 手動実行は 10 秒以内
  const reportStart = Date.now();
  await page.click('button:has-text("生成")');
  await page.waitForSelector('[data-testid="report-complete"]');
  expect(Date.now() - reportStart).toBeLessThan(10000);
});
```

### 3.6 コンソールエラー監視（E2E）

```typescript
test('Leaf console error なし', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/leaf/backoffice');
  await page.waitForLoadState('networkidle');
  expect(errors).toHaveLength(0);
});
```

### 3.7 アクセシビリティ（Integration + E2E）

```typescript
// Integration (axe-core)
it('新規登録モーダルに a11y 違反なし', async () => {
  const { container } = render(<NewCaseWizard />);
  expect(await axe(container)).toHaveNoViolations();
});

// E2E (Lighthouse)
test('Leaf backoffice Lighthouse a11y 90+', async ({ page }) => {
  await page.goto('/leaf/backoffice');
  const result = await runLighthouse(page);
  expect(result.accessibility).toBeGreaterThanOrEqual(0.9);
});
```

---

## 4. E2E 主要 5 フロー

### 4.1 フロー 1: 新規案件登録フルフロー

```typescript
test('Flow 1: 新規案件登録 → 一覧に表示', async ({ page }) => {
  await loginAs(page, 'staff');
  await page.goto('/leaf/backoffice');
  await page.click('button:has-text("+ 新規案件")');

  // Step 1
  await page.selectOption('[name="sales_employee"]', '0008');
  await page.fill('[name="customer_number"]', '123456789');
  await page.fill('[name="customer_name"]', '山田商店');
  await page.setInputFiles('input[type="file"]', 'tests/fixtures/sample-application.pdf');
  // OCR 完了待ち
  await page.waitForSelector('[data-testid="ocr-complete"]');
  await page.click('button:has-text("次へ")');

  // Step 2
  await page.selectOption('[name="contract_type"]', 'high_voltage');
  await page.selectOption('[name="plan_code"]', 'HV-BIZ-1');
  await page.fill('[name="contract_kw"]', '50');
  await page.click('button:has-text("確認して登録")');

  // 一覧で確認
  await page.waitForURL(/\/leaf\/backoffice/);
  await expect(page.getByText('山田商店')).toBeVisible();
});
```

### 4.2 フロー 2: ステータス進行フルフロー（8 段階）

```typescript
test('Flow 2: ステータス進行 ordered → completed 8 段階', async ({ page }) => {
  await loginAs(page, 'admin');
  const caseId = await createTestCase();
  await page.goto(`/leaf/backoffice/cases/${caseId}`);

  const steps = [
    ['諸元を回収しました', 'awaiting_entry'],
    ['エントリーしました', 'awaiting_sending'],
    ['送付しました', 'awaiting_invoice'],
    ['請求しました', 'awaiting_payment'],
    ['入金を確認しました', 'awaiting_payout'],
    ['支払いました', 'completed'],
  ];
  for (const [action, next] of steps) {
    await page.click(`button:has-text("${action}")`);
    await page.waitForSelector(`[data-status="${next}"]`);
  }
  await expect(page.getByText('完了')).toBeVisible();
});
```

### 4.3 フロー 3: 検索・フィルタ・CSV 出力

```typescript
test('Flow 3: 検索 → 絞込 → CSV 出力', async ({ page }) => {
  await loginAs(page, 'staff');
  await page.goto('/leaf/backoffice');
  await page.fill('[name="search"]', '山田');
  await page.selectOption('[name="status_filter"]', 'awaiting_specs');
  await page.waitForSelector('[data-testid="case-row"]');
  await page.click('button:has-text("CSV 出力")');
  // DL 完了待ち
  const download = await page.waitForEvent('download');
  expect(download.suggestedFilename()).toMatch(/leaf-kanden-\d{8}\.csv/);
});
```

### 4.4 フロー 4: 解約フロー

```typescript
test('Flow 4: 解約 → cancellation_flag=true + 編集不可', async ({ page }) => {
  await loginAs(page, 'admin');
  const caseId = await createTestCase({ status: 'awaiting_entry' });
  await page.goto(`/leaf/backoffice/cases/${caseId}`);
  await page.click('button:has-text("解約")');
  await page.fill('[name="cancellation_reason"]', '顧客都合のため解約（10 文字以上）');
  await page.click('button:has-text("解約を確定")');

  // 解約後の表示
  await expect(page.getByText('解約済み')).toBeVisible();
  await expect(page.getByRole('button', { name: '諸元を回収しました' })).toBeDisabled();
});
```

### 4.5 フロー 5: 営業ロールでの権限テスト

```typescript
test('Flow 5: cs ロール - 自分の案件のみ閲覧・限定編集', async ({ page }) => {
  await loginAs(page, 'cs');  // sales_employee_number = 0010 想定
  await page.goto('/leaf/backoffice');

  // 自分の案件は見える
  await expect(page.getByTestId('case-row').first()).toBeVisible();

  // 他人の案件詳細に直接遷移 → 404
  await page.goto('/leaf/backoffice/cases/OTHER-PERSON-CASE-ID');
  await expect(page.getByText('案件が見つかりませんでした')).toBeVisible();

  // 自分の案件でもステータス進行ボタンは押せない
  await page.goto('/leaf/backoffice/cases/MY-CASE-ID');
  await expect(page.getByRole('button', { name: '諸元を回収しました' })).toBeDisabled();
});
```

---

## 5. α版 → β版 → リリース版 の 3 段階展開（§17 準拠）

### 5.1 α版（東海林さん 1 人、即時〜1 週間）

- **対象**: 東海林さんのみ
- **確認項目**:
  - Phase C 全機能（C-01〜C-05）の動作
  - 既存 FileMaker 11 と同等の入力速度
  - §16 7 種テスト自動化分すべて通過

**α版リリース判定基準**:
- E2E スモーク 5 本通過
- Unit 70% / Integration 50% カバー
- コンソールエラーゼロ
- Lighthouse a11y 90+

### 5.2 β版（3-5 人、2 週間）

- **対象**:
  - 事務担当 2 名（Kanden 事務のメインユーザー）
  - 営業 1-2 名
  - 経理（東海林さん）
- **期間**: 2 週間
- **運用**: 新旧並行（FileMaker + Garden 両方使用、差異をレビュー）
- **収集**: `docs/field-feedback-YYYYMMDD-leaf.md` に記録（§17 準拠）

**β版リリース判定基準**:
- 🐛 バグ ゼロ or 🟡 軽微のみ
- 💡 UX 改善要望 5 件以下
- ⚠️ 重大（業務停止級）ゼロ
- 新旧データの整合性 100%（手動突合）

### 5.3 リリース版（全社、M4 中）

- **対象**: Leaf 関電業務委託を扱う全ユーザー（10-15 人想定）
- **タイミング**: Phase B-2 末（M4、2026-08 頃）
- **FileMaker 停止**: リリース版運用 2 週間後に停止（切替猶予期間）

---

## 6. テストデータ

### 6.1 seed データ（`tests/fixtures/leaf-seed.sql`）

```sql
-- テスト用案件 20 件
INSERT INTO soil_kanden_cases (case_id, status, customer_number, customer_name, sales_employee_number, ordered_at) VALUES
  ('TEST-CASE-001', 'ordered', '123456789', 'テスト商店1', '0008', '2026-04-01'),
  ('TEST-CASE-002', 'awaiting_specs', '123456790', 'テスト商店2', '0008', '2026-04-02'),
  -- 8 ステータス × 2-3 件ずつ
  ...
;

-- 営業員（既存 root_employees に追加）
INSERT INTO root_employees (employee_number, name, garden_role, is_active) VALUES
  ('9001', 'テスト営業', 'cs', true),
  ('9002', 'テスト事務', 'staff', true),
  ('9003', 'テスト管理者', 'admin', true)
ON CONFLICT DO NOTHING;
```

### 6.2 MSW ハンドラ（Integration）

```typescript
// tests/mocks/leaf-handlers.ts
import { http, HttpResponse } from 'msw';

export const leafHandlers = [
  http.get('*/rest/v1/soil_kanden_cases', ({ request }) => {
    const url = new URL(request.url);
    // filter 処理
    return HttpResponse.json([/* ... */]);
  }),
  http.post('*/rest/v1/soil_kanden_cases', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ ...body, case_id: 'TEST-NEW-ID' });
  }),
];
```

---

## 7. CI 実行計画

### 7.1 PR チェック（spec-cross-test-strategy §5.2 準拠）

```yaml
# .github/workflows/leaf-test.yml
- name: Unit
  run: npm run test:unit -- src/app/leaf
- name: Integration（leaf 変更時）
  run: npm run test:integration -- tests/integration/leaf
  if: contains(steps.changed.outputs.files, 'src/app/leaf')
- name: E2E smoke（main / develop マージ時）
  run: npx playwright test tests/e2e/leaf --project=chromium
  if: github.base_ref == 'main' || github.base_ref == 'develop'
```

### 7.2 Nightly

- 全 E2E（Leaf 5 フロー）× 2 ブラウザ
- Lighthouse CI（a11y + performance）

### 7.3 α版リリース前の完走テスト

手動チェックリスト（`docs/pre-release-test-YYYYMMDD-leaf.md` に記録）：

```markdown
# Leaf Phase C α版 リリース前テスト

## §16 7 種
- [ ] 機能網羅（Integration + E2E）
- [ ] エッジケース（Unit、27 ケース以上）
- [ ] 権限（E2E、ロール 4 種）
- [ ] データ境界（Unit、6 ケース以上）
- [ ] パフォーマンス（E2E、3 秒以内）
- [ ] コンソールエラー（E2E、ゼロ）
- [ ] アクセシビリティ（Lighthouse 90+）

## カバレッジ
- [ ] Unit 70% 以上
- [ ] Integration 50% 以上
- [ ] E2E スモーク 5 本通過

## 手動確認
- [ ] FileMaker 11 と入力速度比較（±20% 以内）
- [ ] UX 文言チェック（spec C-02 §4 準拠）
- [ ] 新旧データ整合性（10 件サンプリング）
```

---

## 8. 実装ステップ

### W1: テスト環境セットアップ（0.1d）
- [ ] `vitest.config.ts` の Leaf 設定追加
- [ ] `tests/integration/leaf/` ディレクトリ作成
- [ ] `tests/e2e/leaf/` ディレクトリ作成
- [ ] `tests/fixtures/leaf-seed.sql` 投入スクリプト

### W2: Unit テスト（0.2d）
- [ ] `_lib/queries.ts` の 10 関数
- [ ] `_lib/calendar.ts`（供給開始日計算）
- [ ] ステータス遷移バリデーション 8 種
- [ ] 供給地点番号フォーマット / パース
- [ ] 手数料計算関数

### W3: Integration テスト（0.2d）
- [ ] `NewCaseWizard` Step 1/2 のバリデーション
- [ ] `CaseFilterPanel` 絞込
- [ ] `CaseEditModal` セクション別編集
- [ ] `CancellationModal` 理由必須

### W4: E2E 主要 5 フロー（0.2d）
- [ ] Flow 1-5 の実装
- [ ] seed データ投入 + teardown

### W5: α版チェックリスト実行（0.05d）
- [ ] 手動確認項目チェック
- [ ] MF11 との比較

---

## 9. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | E2E のブラウザ | Chromium + Mobile Safari、Firefox はスキップ |
| 判2 | テスト用 Supabase project | garden-test に Leaf seed 追加、他モジュールと共有 |
| 判3 | α版の期間 | 東海林さんの判断次第、目安 1 週間 |
| 判4 | β版の運用 | 新旧並行が原則、切替は β版 2 週後 |
| 判5 | カバレッジ目標未達時の扱い | PR 警告のみ、ブロックは α版直前まで延長可 |
| 判6 | OCR 精度のテスト | 固定サンプル 10 件で信頼度 80% 以上を確認、それ以外は範囲外 |

---

## 10. 関連参照

- **spec-cross-test-strategy**（Batch 7）: 3 レイヤ + 7 種テスト接続
- **C-01 〜 C-05**: テスト対象の全 spec
- **親 CLAUDE.md §16**: 7 種テスト定義
- **親 CLAUDE.md §17**: 3 段階展開

— end of C-06 —
