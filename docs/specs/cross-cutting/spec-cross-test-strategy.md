# Cross-Cutting Spec: テスト戦略 統一（Vitest / RTL+MSW / Playwright）

- 優先度: **🟡 中**
- 見積: **0.5d**（戦略策定）+ **段階導入で +2-3d**（ベース環境整備）
- 作成: 2026-04-24（a-auto / Batch 7 Garden 横断 #6）
- 前提: 親 CLAUDE.md §16「リリース前バグ確認ルール」, Bud `_lib/__tests__` 既存

---

## 1. 背景と目的

### 1.1 現状

- Bud に Vitest 4 本（`duplicate-key` / `transfer-id` / `transfer-status` / `status-display`）既存
- Forest / Bloom / Root はテスト未整備
- §16 の 7 種テスト（機能網羅・エッジ・権限・境界・パフォ・コンソール・a11y）との接続が曖昧
- E2E（Playwright）は未導入

### 1.2 本 spec のゴール

- **テストレイヤ 3 段（Unit / Integration / E2E）**の役割分担統一
- §16 の 7 種テストと各レイヤの接続マップ
- モジュール別厳格度（Tree / Bud / Root = 🔴 最厳格 / Leaf = 🟡 / 他 = 🟡）
- CI 実行方針

---

## 2. テストレイヤ 3 段

### 2.1 Unit（Vitest）— **純関数・ロジック**

**対象**:
- `_lib/` 配下の純粋関数（計算・変換・バリデーション）
- ユーティリティ（format / parse / calculate）

**目的**:
- ロジックの正当性を最小単位で保証
- 外部依存（Supabase / fetch）は mock

**例（Bud 既存）**:
- `transfer-status.test.ts`: `canTransition()` の 20 ケース
- `transfer-id.test.ts`: `generateTransferId()` の 10 ケース
- `duplicate-key.test.ts`: 冪等性検証

**目標カバレッジ**: `_lib/` の 80% 以上

### 2.2 Integration（RTL + MSW）— **コンポーネント + Supabase**

**対象**:
- Client Component の振る舞い（フォーム送信、状態遷移、エラー表示）
- Server Component（React Testing Library で rendering 検証）
- Supabase クライアントの振る舞い（MSW で HTTP モック）

**目的**:
- UI とデータ層の連携を保証
- ユーザー視点のインタラクション検証

**例（Phase B で整備）**:
- `TransferDetailPage.test.tsx`: 承認ボタン押下 → API 呼出 → toast 表示
- `SalaryRecordRow.test.tsx`: 本人のみデータ表示、他人は非表示

**使用ライブラリ**:
- `@testing-library/react`
- `msw` (Mock Service Worker) - Supabase REST API モック
- `vitest` (runner)

### 2.3 E2E（Playwright）— **ユーザーフロー全体**

**対象**:
- ログイン → 操作 → データ反映の**業務フロー**
- 権限ロール別（staff / approver / admin）の動作確認
- 複数ページ遷移を伴うフロー

**目的**:
- 本番に近い環境での回帰検証
- §17 3 段階テスト（α / β / リリース）の自動化基礎

**例（Phase C で整備）**:
- Bud 振込: 下書き → 承認待ち → 承認 → CSV 出力 → 完了までの全フロー
- Tree ログイン → 架電 → 結果登録 → Leaf 引継 のクロスモジュールフロー

**使用ライブラリ**:
- `@playwright/test`
- Supabase test project（本番データと分離、teardown で clean）

---

## 3. §16 7 種テストとの接続

親 CLAUDE.md §16「リリース前バグ確認ルール」の 7 種と、上記 3 レイヤの対応：

| §16 テスト | Unit | Integration | E2E |
|---|---|---|---|
| 1. 機能網羅 | - | ✅ 主担当 | ✅ 補完 |
| 2. エッジケース | ✅ 純関数 | ✅ UI 境界 | - |
| 3. 権限 | ✅ ロール判定関数 | ✅ Component | **✅ E2E 主担当**（実ロールで操作）|
| 4. データ境界 | ✅ 計算関数 | ✅ DB | - |
| 5. パフォーマンス | - | - | **✅ E2E のみ**（実測）|
| 6. コンソールエラー | - | ✅ 検出 | ✅ 検出 |
| 7. アクセシビリティ | - | ✅ axe-core | ✅ Lighthouse |

### 3.1 各テストの書き方ガイド

#### 機能網羅（Integration）
```typescript
describe('TransferDetailPage', () => {
  it.each([
    ['下書き', 'staff', ['確認済みへ', '削除']],
    ['承認待ち', 'approver', ['承認', '差戻し']],
    ['承認済み', 'admin', ['CSV出力']],
    ['振込完了', 'admin', []],  // ボタンなし
  ])('%s 状態 × %s ロール で表示されるボタンが正しい', (status, role, expected) => {
    render(<TransferDetailPage status={status} role={role} />);
    expected.forEach(btn => expect(screen.getByRole('button', { name: btn })).toBeInTheDocument());
  });
});
```

#### エッジケース（Unit）
```typescript
describe('calculateOvertimePay', () => {
  it('残業 0 分のとき 0 円', () => {
    expect(calculateOvertimePay(1600000, 0)).toBe(0);
  });
  it('残業 60 分 × 1.25 割増', () => {
    expect(calculateOvertimePay(1600000, 60)).toBe(12500);  // 1600000/160 * 1 * 1.25
  });
  it('月 60 時間超は 1.50 倍（判断保留）', () => {
    // 判4 が Phase B v2 まで 1.25 固定、Phase C で厳密化
    expect(calculateOvertimePay(1600000, 61 * 60)).toBe(calculateOvertimePay(1600000, 61 * 60)); // 暫定
  });
});
```

#### 権限（E2E）
```typescript
// tests/e2e/bud/approval-flow.spec.ts
test('approver は approve ボタンを押せる', async ({ page, context }) => {
  // approver としてログイン
  await page.goto('/bud/login');
  await page.fill('#employee_id', '0004'); // 上田基人
  await page.fill('#password', 'XXXX');
  await page.click('button[type="submit"]');

  // 承認待ち詳細に遷移
  await page.goto('/bud/transfers/FK-20260424-0001');
  await expect(page.getByRole('button', { name: '承認' })).toBeVisible();
  await page.click('button:has-text("承認")');
  await expect(page.getByText('承認しました')).toBeVisible();
});

test('staff は approve ボタンを見ない', async ({ page }) => {
  // staff としてログイン
  await loginAs(page, 'staff');
  await page.goto('/bud/transfers/FK-20260424-0001');
  await expect(page.getByRole('button', { name: '承認' })).not.toBeVisible();
});
```

#### データ境界（Unit）
```typescript
describe('parseAmount', () => {
  it('0 円許容', () => expect(parseAmount('0')).toBe(0));
  it('負値エラー', () => expect(() => parseAmount('-1')).toThrow());
  it('カンマ区切り', () => expect(parseAmount('1,234,567')).toBe(1234567));
  it('上限 99999999', () => expect(parseAmount('100000000')).toBe(99999999));  // 上限切上
  it('小数点禁止', () => expect(() => parseAmount('100.5')).toThrow());
});
```

#### パフォーマンス（E2E）
```typescript
test('振込一覧 200 件を 2 秒以内にレンダリング', async ({ page }) => {
  const start = Date.now();
  await page.goto('/bud/transfers');
  await page.waitForSelector('[data-testid="transfer-row"]:nth-child(200)');
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(2000);
});
```

#### コンソールエラー（E2E）
```typescript
test('Forest ダッシュボードで console error なし', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => msg.type() === 'error' && errors.push(msg.text()));
  await page.goto('/forest/dashboard');
  await page.waitForLoadState('networkidle');
  expect(errors).toHaveLength(0);
});
```

#### a11y（Integration + E2E）
```typescript
// Integration（axe-core）
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('フォームに a11y 違反なし', async () => {
  const { container } = render(<NewTransferForm />);
  expect(await axe(container)).toHaveNoViolations();
});

// E2E（Lighthouse CLI）
test('給与明細画面 Lighthouse a11y スコア 90+', async ({ page }) => {
  await page.goto('/tree/mypage/salary');
  const result = await runLighthouse(page, { categories: ['accessibility'] });
  expect(result.accessibility).toBeGreaterThanOrEqual(0.9);
});
```

---

## 4. モジュール別厳格度

### 4.1 🔴 最厳格（本番投入前に全 7 種テスト完走必須）

#### Tree
- **理由**: FileMaker 切替、失敗許されない（§18 Phase D 特例）
- **対象**: 全画面、全フロー
- **カバレッジ目標**: 単体 80% / 統合 70% / E2E 主要 20 フロー

#### Bud
- **理由**: 金銭処理、計算ミス = 実損害
- **対象**: 振込・給与・賞与の計算・承認・振込実行
- **カバレッジ目標**: 単体 90%（計算系）/ 統合 70% / E2E 主要 15 フロー

#### Root
- **理由**: 認証・権限・マスタ、破損時の影響大
- **対象**: 認証フロー、RLS、マスタ CRUD
- **カバレッジ目標**: 単体 80% / 統合 70% / E2E 権限別 10 フロー

### 4.2 🟡 通常（主要フロー + 高リスク機能で 7 種テスト）

#### Leaf（関電業務委託）
- **理由**: データ整合性重視、業務影響中
- **対象**: 案件フロー（8 ステータス）、添付書類、至急 SW 判定
- **カバレッジ目標**: 単体 70% / 統合 50% / E2E 主要 5 フロー

#### Forest
- **理由**: 閲覧中心、修正権限は admin のみ
- **対象**: 決算書 DL / 進行期編集 / HANKANHI
- **カバレッジ目標**: 単体 70% / 統合 50% / E2E 主要 3 フロー

#### Bloom
- **理由**: 内部可視化、金銭処理なし
- **対象**: 月次ダイジェスト発行、Workboard
- **カバレッジ目標**: 単体 60% / 統合 40% / E2E 主要 3 フロー

### 4.3 🟢 標準（単体テスト + 機能網羅のみ）

#### Soil / Rill / Seed
- **理由**: 大量データ基盤 / API 連携 / 新事業枠、業務クリティカルではない
- **対象**: 主要 API のみ
- **カバレッジ目標**: 単体 50% / 統合 20%

---

## 5. CI 実行方針

### 5.1 pre-commit（ローカル）

```bash
# husky / lefthook で強制
npm run lint
npm run typecheck
npm run test:unit  # ~5 秒、変更影響のあるファイルのみ
```

### 5.2 PR（GitHub Actions）

| Job | 実行 | 時間目標 |
|---|---|---|
| Lint / Typecheck | 毎 PR | 2 分以内 |
| Unit（全件）| 毎 PR | 5 分以内 |
| Integration | 毎 PR（🔴 モジュールのみ変更時）| 10 分以内 |
| E2E smoke | 毎 PR（main/develop 向け）| 5 分以内（主要 5 ケース）|

### 5.3 Nightly（main ブランチ）

| Job | 実行 | 内容 |
|---|---|---|
| 全 E2E | 毎夜 02:00 JST | 全モジュール完全テスト |
| Lighthouse CI | 毎夜 | パフォーマンス + a11y |
| Sentry error digest | 毎夜 | 前日エラー集計 |

### 5.4 リリース前（§16 準拠）

各モジュール α/β/リリース版昇格時に実施：
- 全 7 種テスト完走
- カバレッジ目標達成
- E2E フローすべて通過
- Lighthouse a11y 90+、performance 80+

結果を `docs/pre-release-test-YYYYMMDD-<module>.md` に記録。

---

## 6. テストデータ管理

### 6.1 テスト用 Supabase Project

```
garden-test（新規作成）
  ├─ 開発者ローカル: .env.test で接続
  ├─ CI: GitHub Secrets で接続
  └─ staging: 通常は garden-dev と共有
```

### 6.2 Seed データ

```typescript
// tests/fixtures/seed.ts
export const TEST_EMPLOYEES = [
  { employee_id: 'TEST-0001', name: 'テスト太郎', garden_role: 'staff' },
  { employee_id: 'TEST-0002', name: 'テスト花子', garden_role: 'approver' },
  { employee_id: 'TEST-0003', name: 'テスト管理', garden_role: 'admin' },
];

// beforeAll / afterAll で投入・クリーンアップ
```

### 6.3 MSW ハンドラ（Integration）

```typescript
// tests/mocks/supabase-handlers.ts
import { http, HttpResponse } from 'msw';

export const supabaseHandlers = [
  http.get('*/rest/v1/bud_transfers', () => {
    return HttpResponse.json([
      { id: 'x', status: '下書き', amount: 10000 },
    ]);
  }),
  // ...
];
```

---

## 7. 実装ステップ

### W1: Vitest ベース整備（0.1d）

既に Bud で導入済、他モジュールへ横展開：
- [ ] `vitest.config.ts` をルートで統一
- [ ] `package.json` scripts: `test:unit`, `test:unit:watch`
- [ ] カバレッジレポート（`--coverage`）

### W2: RTL + MSW 導入（0.15d）

- [ ] `@testing-library/react` / `@testing-library/jest-dom` 導入
- [ ] `msw` 導入、Supabase REST API モックハンドラ雛形
- [ ] `tests/integration/` ディレクトリ構造
- [ ] Bloom の Workboard コンポーネントで初回実装

### W3: Playwright 導入（0.15d）

- [ ] `@playwright/test` セットアップ
- [ ] `tests/e2e/` ディレクトリ構造
- [ ] `garden-test` Supabase project 作成（東海林さん承認）
- [ ] 初回: Bud ログイン → 振込一覧のみ

### W4: axe-core / Lighthouse 連携（0.05d）

- [ ] `jest-axe` 導入
- [ ] Lighthouse CI 設定（GitHub Actions）

### W5: CI 構築（0.05d）

- [ ] GitHub Actions ワークフロー統合
- [ ] 🔴 モジュール変更時に Integration 実行
- [ ] Nightly 用ワークフロー

---

## 8. 実装テンプレ集

### 8.1 `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/_types/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

### 8.2 `tests/setup.ts`

```typescript
import '@testing-library/jest-dom';
import { setupServer } from 'msw/node';
import { supabaseHandlers } from './mocks/supabase-handlers';

export const server = setupServer(...supabaseHandlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 8.3 `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 2,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile',   use: { ...devices['iPhone 13'] }  },
  ],
});
```

---

## 9. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | Jest vs Vitest | **Vitest 統一**（Bud 既存に揃える、Next.js と相性良）|
| 判2 | `@testing-library/react` vs `Enzyme` | **RTL 推奨**（React 18 + Hooks 対応）|
| 判3 | Storybook 導入 | **Phase C 以降**、コンポーネント数が増えてから |
| 判4 | Visual Regression（Chromatic 等）| **Phase D 以降**、まずは機能テスト優先 |
| 判5 | E2E の DB リセット頻度 | テストごと（slow but safe）、並列実行は後で最適化 |
| 判6 | テスト用 Supabase project の料金 | Free tier で 500MB 以内を目標、2 プロジェクト併用 |
| 判7 | MF クラウド給与との突合テスト | §16 範囲外、別途「運用テスト」で実施（手動）|
| 判8 | E2E を Playwright vs Cypress | **Playwright 推奨**（複数ブラウザ対応、TypeScript 親和性）|
| 判9 | カバレッジ目標の強制 | **PR で警告のみ**、強制ブロックは Phase C |

---

## 10. モジュール別テスト着手マイルストーン

| モジュール | Unit 開始 | Integration 開始 | E2E 開始 |
|---|---|---|---|
| Bud | ✅ 済（Phase 0）| Phase A 末（M2）| Phase B-1（M3）|
| Root | Phase A-2 中（M2）| Phase A-2 末 | Phase B-1（M3）|
| Forest | Phase A 末（M2）| Phase B（M3）| Phase B 末（M4）|
| Bloom | Phase B（M3）| Phase C（M5）| Phase C 末（M6）|
| Leaf | Phase B-2（M4）| Phase C（M5）| Phase C 末（M6）|
| **Tree** | **Phase D 入口（M7）**| 同 | **§17 α版前**（M7 末）|
| Soil / Rill / Seed | Phase C 以降 | 任意 | 任意 |

---

## 11. 次アクション

1. `vitest.config.ts` と `tests/setup.ts` をルートに配置（小さな改修で即開始可）
2. Bud の既存 `_lib/__tests__` を「本 spec 準拠のお手本」として `docs/` に要約
3. RTL + MSW 導入 PR は M2 第 1 週目標
4. E2E は M3 に Bud Phase B-1 実装と並行
5. 本 spec を `docs/specs/cross-cutting/` に配置、`known-pitfalls.md` §5 からリンク
