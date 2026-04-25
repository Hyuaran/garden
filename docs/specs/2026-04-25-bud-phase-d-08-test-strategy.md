# Bud Phase D #08: テスト戦略（Phase A 282 tests 流儀踏襲）

- 対象: Garden-Bud Phase D（給与処理）全機能のテスト戦略
- 優先度: **🔴 最高**（金銭・労務、誤計算は法令違反リスク）
- 見積: **0.5d**（テスト計画 + 共通 fixture + CI）
- 担当セッション: a-bud（実装）/ a-bloom（レビュー）
- 作成: 2026-04-25（a-auto 005 / Batch 17 Bud Phase D #08）
- 前提:
  - **Bud Phase A の 282 tests**（既存、流儀踏襲）
  - **Bud Phase D-01〜07**
  - Cross Cutting `spec-cross-test-strategy`
  - §16 リリース前バグ確認ルール

---

## 1. 目的とスコープ

### 1.1 目的

Bud Phase D の全機能に**境界値・エッジケース・法令準拠**を網羅するテストを整備する。Phase A で確立した **282 tests** の流儀（fixture 駆動 + 境界値中心 + 全 RLS テスト）を踏襲し、給与計算・社保・年末調整等の**金銭計算誤りゼロ**を保証する。

### 1.2 含めるもの

- 単体テスト戦略（計算ロジック中心）
- 統合テスト戦略（Trx + RLS + Storage 連携）
- E2E テスト戦略（Playwright、給与確定 → 振込 → 配信 一気通貫）
- 法令テスト（労基法・所得税法・健保厚年法）
- 共通 fixture（`tests/_fixtures/`）
- CI パイプライン

### 1.3 含めないもの

- 実装そのもの → D-01〜07
- 性能テスト → 個別 spec で記述
- セキュリティ監査 → Cross Ops #06 §6

---

## 2. テスト構成（Phase A 流儀）

### 2.1 ファイル構成

```
tests/
├─ _fixtures/
│  ├─ employees.ts              … 雇用形態・年齢・甲乙パターン網羅
│  ├─ salary-systems.ts         … 給与体系
│  ├─ attendance-snapshots.ts   … 勤怠パターン
│  ├─ insurance-rates.ts        … 都道府県別 + 業種別
│  └─ withholding-tables.ts     … 源泉徴収表（甲乙）
├─ unit/
│  ├─ d-01-attendance-snapshot.test.ts
│  ├─ d-02-salary-calc.test.ts          ← 100+ ケース予定
│  ├─ d-03-bonus-calc.test.ts           ← 50+ ケース
│  ├─ d-04-pdf-generation.test.ts
│  ├─ d-05-social-insurance.test.ts     ← 80+ ケース
│  ├─ d-06-year-end-settlement.test.ts
│  ├─ d-07-fb-data-generation.test.ts   ← 50+ ケース
│  └─ helpers/
│     ├─ phone-normalizer.test.ts
│     └─ kana-converter.test.ts
├─ integration/
│  ├─ payroll-trx.test.ts               … Trx 内整合性
│  ├─ rls-by-role.test.ts               … 7 ロール × CRUD
│  ├─ storage-pdf.test.ts               … PDF 生成 → Storage 保存 → DL
│  └─ pii-encryption.test.ts            … マイナンバー暗号化
├─ e2e/
│  ├─ payroll-full-flow.spec.ts         … 計算 → 承認 → 振込 → 配信
│  └─ year-end-flow.spec.ts             … 年末調整 → 12 月精算
└─ legal/
   ├─ rouki-act-compliance.test.ts      … 労基法準拠
   ├─ shotokuzei-act-compliance.test.ts … 所得税法準拠
   └─ kenpo-kounen-compliance.test.ts   … 健保厚年法準拠
```

### 2.2 fixture の設計原則

- **網羅性**: 雇用形態 × 年齢階層 × 甲乙 × 扶養人数 を全組合せ
- **再利用性**: 1 fixture から派生して各テストで使う
- **法令妥当性**: 実際の月額表 / 等級表 を反映

```typescript
// tests/_fixtures/employees.ts
export const employeeFixtures = {
  // 正社員 30 歳 甲 扶養 0 人
  regular_30_kou_0: {
    employment_type: 'regular',
    date_of_birth: '1996-04-01',
    kou_otsu: 'kou',
    dependents_count: 0,
    // ...
  },

  // 正社員 45 歳 甲 扶養 2 人 介護対象
  regular_45_kou_2_care: { /* ... */ },

  // アルバイト 22 歳 乙
  parttime_22_otsu: { /* ... */ },

  // 退職予定（月途中）
  regular_retiring_midmonth: { /* ... */ },

  // 育休中（社保免除）
  regular_on_childcare_leave: { /* ... */ },

  // 50 種類以上
};
```

---

## 3. 単体テスト（unit/）

### 3.1 D-02 給与計算（100+ ケース）

#### 必須テストグループ

```typescript
describe('calculateMonthlySalary', () => {
  describe('基本給計算', () => {
    it('正社員 / フル出勤 → 基本給 = root_salary_systems.basic_pay', ...);
    it('正社員 / 月途中入社 → 日割計算', ...);
    it('正社員 / 月途中退職 → 日割計算', ...);
    it('正社員 / 欠勤 5 日 → 欠勤控除', ...);
    it('アルバイト / 時給制 → 時給 × 実労働時間', ...);
    it('アルバイト / 残業 → 1.25 倍', ...);
  });

  describe('割増賃金（法定）', () => {
    it('時間外 60h 以下 → 25% 割増', ...);
    it('時間外 60h 超 → 50% 割増', ...);
    it('深夜（22-5 時）→ 25% 加算', ...);
    it('時間外 + 深夜重複 → 50% 加算', ...);
    it('法定休日労働 → 35% 割増', ...);
    it('法定休日 + 深夜重複 → 60% 加算', ...);
  });

  describe('源泉徴収', () => {
    it('甲欄 / 扶養 0 → 月額表通り', ...);
    it('甲欄 / 扶養 3 → 控除あり', ...);
    it('甲欄 / 扶養 8 → 7 人超の特例', ...);
    it('乙欄 → 一律高税率', ...);
    it('課税対象額 = gross - 社保 - 通勤手当', ...);
  });

  describe('境界値', () => {
    it('月額表の最小値 0 円', ...);
    it('月額表の最大値（範囲外でエラー）', ...);
    it('扶養 7 人 vs 8 人の境界', ...);
    it('60h 超残業の境界（59h59m / 60h00m / 60h01m）', ...);
  });

  describe('エラー / 警告', () => {
    it('100h 超残業 → ERROR', ...);
    it('80h 超残業 → WARNING + 計算続行', ...);
    it('net_pay マイナス → ERROR', ...);
    it('住民税未登録 → WARNING', ...);
  });

  describe('冪等性', () => {
    it('同じ入力で 100 回実行 → 全て同じ出力', ...);
    it('mode=simulation で DB 書込なし', ...);
  });
});
```

### 3.2 D-03 賞与計算（50+ ケース）

```typescript
describe('calculateBonus', () => {
  describe('社保上限', () => {
    it('健保 573 万円 / 年度累計上限', ...);
    it('厚年 150 万円 / 1 回上限', ...);
    it('境界値（572.999 / 573.001）', ...);
  });

  describe('算出率表（賞与）', () => {
    it('前月給与 0 → 6 ヶ月按分特例', ...);
    it('前月給与あり → 算出率ルックアップ', ...);
    it('扶養人数別税率', ...);
  });

  describe('介護保険', () => {
    it('39 歳 → 介護なし', ...);
    it('40 歳到達月 → 介護あり', ...);
    it('65 歳到達月の前月 → 介護なし', ...);
  });

  describe('雇用保険', () => {
    it('一般事業 0.6%', ...);
    it('建設業 0.7%', ...);
  });
});
```

### 3.3 D-05 社保（80+ ケース）

```typescript
describe('calculateMonthlyInsurance', () => {
  describe('健保（協会けんぽ）', () => {
    it('東京 / 30 歳 / 標準報酬月額 30 万', ...);
    it('大阪 / 40 歳 / 介護加算', ...);
    it('神奈川 / 65 歳 / 介護なし', ...);
  });

  describe('厚生年金', () => {
    it('一律 18.3% 労使折半', ...);
    it('30 等級の上限到達', ...);
  });

  describe('月変判定', () => {
    it('3 ヶ月連続 +2 等級 → 改定対象', ...);
    it('3 ヶ月連続 -2 等級 → 改定対象', ...);
    it('+1 等級のみ → 対象外', ...);
    it('支払基礎日数 17 日未満 → 対象外', ...);
    it('固定的賃金不変 → 対象外', ...);
  });

  describe('算定基礎届', () => {
    it('4-6 月 3 ヶ月平均', ...);
    it('中途入社（5 月入社）→ 対象外', ...);
    it('育休中 → 対象外', ...);
  });

  describe('免除', () => {
    it('産休中 → 健保・厚年・介護 0', ...);
    it('育休中 → 同上', ...);
    it('雇用保険は免除なし', ...);
  });
});
```

### 3.4 D-07 FB データ生成（50+ ケース）

```typescript
describe('generateFbData', () => {
  describe('レコード構造', () => {
    it('ヘッダ 120 桁', ...);
    it('データ 120 桁 × 件数', ...);
    it('トレーラ 120 桁 + 合計金額', ...);
    it('エンド 120 桁', ...);
  });

  describe('半角カナ変換', () => {
    it('全角カタカナ → 半角', ...);
    it('濁音「ガ」→ 「ｶﾞ」', ...);
    it('半濁音「パ」→ 「ﾊﾟ」', ...);
    it('長音「ー」→ 「-」', ...);
    it('未対応文字 → エラー', ...);
  });

  describe('文字コード', () => {
    it('Shift_JIS で出力', ...);
    it('CR LF 改行', ...);
  });

  describe('境界値', () => {
    it('1 件のみ', ...);
    it('1,000 件超', ...);
    it('合計金額 9,999,999,999 円', ...);
  });
});
```

---

## 4. 統合テスト（integration/）

### 4.1 RLS by Role（7 ロール × 3 テーブル × CRUD）

```typescript
describe('Bud Phase D RLS', () => {
  for (const role of ['toss', 'closer', 'cs', 'staff', 'manager', 'admin', 'super_admin']) {
    for (const table of ['bud_salary_records', 'bud_bonus_records', 'bud_payroll_periods']) {
      for (const action of ['select_own', 'select_others', 'insert', 'update', 'delete']) {
        it(`${role} × ${table} × ${action}`, async () => {
          // クライアントを role 化、操作を試行、期待値検証
        });
      }
    }
  }
});
```

### 4.2 Trx 整合性

```typescript
describe('Payroll Trx', () => {
  it('給与計算中エラーで全体ロールバック', async () => {
    // 100 名計算中 50 名目でエラー → 全件未保存
  });

  it('振込実行中部分失敗で部分コミット', async () => {
    // 50 名中 3 名口座エラー → 47 名 paid、3 名 failed
  });

  it('年末調整精算が複数テーブル横断で整合', async () => {
    // settlements + salary_records + gensen_choshu_bo
  });
});
```

### 4.3 PII 暗号化

```typescript
describe('Mainakanber Encryption', () => {
  it('保存時に pgcrypto で暗号化', async () => {
    const encrypted = await saveMyNumber(employeeId, '123456789012');
    expect(encrypted).not.toContain('123456789012');
  });

  it('復号は super_admin のみ可能', async () => {
    const asSuperAdmin = await decryptMyNumber(employeeId, asUser('super_admin'));
    expect(asSuperAdmin).toBe('123456789012');

    await expect(decryptMyNumber(employeeId, asUser('admin')))
      .rejects.toThrow('FORBIDDEN');
  });

  it('復号アクセスが監査ログに記録', async () => {
    await decryptMyNumber(employeeId, asUser('super_admin'));
    const log = await fetchLatestLog('pii_access');
    expect(log.target_id).toBe(employeeId);
  });
});
```

---

## 5. E2E テスト（e2e/）

### 5.1 給与確定 → 振込 → 配信（Playwright）

```typescript
test('Bud Phase D Full Flow', async ({ page }) => {
  // 1. admin ログイン
  await loginAs(page, 'admin');

  // 2. 給与計算実行（10 名分）
  await page.goto('/bud/payroll/2026-04');
  await page.click('[data-test="calculate-all"]');
  await expect(page.locator('[data-test="calc-result"]')).toContainText('10 名計算完了');

  // 3. 承認
  await page.click('[data-test="approve-period"]');

  // 4. 振込バッチ作成
  await page.goto('/bud/payroll/2026-04/transfer');
  await page.click('[data-test="prepare-transfer"]');

  // 5. FB データ生成 + DL
  await page.click('[data-test="generate-fb"]');
  const download = await page.waitForEvent('download');
  expect(download.suggestedFilename()).toMatch(/\.txt$/);

  // 6. 振込完了 mark
  await page.click('[data-test="mark-completed"]');

  // 7. 明細 PDF 一括生成
  await page.click('[data-test="generate-statements"]');
  await expect(page.locator('[data-test="generate-status"]')).toContainText('10 名生成完了');

  // 8. 従業員視点（別タブ / 別ログイン）
  await loginAs(page, 'staff_yamada');
  await page.goto('/bud/my-statements');
  await expect(page.locator('[data-test="statement-2026-04"]')).toBeVisible();
  await page.click('[data-test="download-2026-04"]');
  // ダウンロード確認
});
```

---

## 6. 法令テスト（legal/）

### 6.1 労基法準拠

```typescript
describe('労働基準法 準拠', () => {
  it('第 24 条: 毎月払い・全額払い', ...);
  it('第 32 条: 法定労働時間 8h/日 40h/週', ...);
  it('第 37 条: 法定割増率 25/50/25/35%', ...);
  it('第 39 条: 有給休暇付与', ...);
  it('第 109 条: 賃金台帳 5 年保管', ...);
});
```

### 6.2 所得税法準拠

```typescript
describe('所得税法 準拠', () => {
  it('第 183 条: 源泉徴収義務', ...);
  it('第 186 条: 賞与の源泉徴収（算出率表）', ...);
  it('第 190 条: 年末調整', ...);
  it('第 226 条: 源泉徴収票交付（翌 1/31 まで）', ...);
});
```

### 6.3 健保厚年法準拠

```typescript
describe('健康保険法・厚生年金保険法 準拠', () => {
  it('第 40 条（健保）: 標準報酬月額', ...);
  it('第 21 条（厚年）: 30 等級制', ...);
  it('賞与上限（健保 573 万円 / 厚年 150 万円）', ...);
  it('産休・育休の保険料免除', ...);
});
```

---

## 7. CI パイプライン

### 7.1 段階別実行

| 段階 | 実行 | 所要時間 |
|---|---|---|
| Pre-commit | 変更ファイル関連のみ | < 30 秒 |
| Push（PR）| 全 unit + 全 integration | 5-10 分 |
| Merge（develop）| 全 unit + integration + e2e（最低限）| 15-20 分 |
| Nightly | 全 e2e + 全 legal + 性能 | 30-60 分 |

### 7.2 失敗時の動作

- Pre-commit: コミット拒否
- PR: green でないと merge 不可
- Nightly 失敗: Chatwork 通知、翌朝 a-bud 確認

---

## 8. テストデータ管理

### 8.1 test 環境のシード

```typescript
// tests/_fixtures/seed.ts
export async function seedBudPhaseD() {
  await seedRootEmployees(50);  // 雇用形態・年齢分散
  await seedSalarySystems();
  await seedInsuranceRates();
  await seedWithholdingTables();
  await seedAttendanceSnapshots();
}
```

### 8.2 isolation

- 各テストは**独立した期間**を使用（`payroll_period_id` を test ごとに生成）
- DB rollback or transaction で cleanup
- 並列実行可能

---

## 9. カバレッジ目標

### 9.1 統計

| 項目 | 目標 |
|---|---|
| 行カバレッジ | 90% 以上 |
| 分岐カバレッジ | 85% 以上 |
| 関数カバレッジ | 95% 以上 |
| 計算系（D-02/03/05）| **100% 行**（網羅必須）|

### 9.2 例外

- マスタテーブル CRUD UI は手動テストで代替可
- PDF レンダリング（react-pdf）は visual diff で代替可

---

## 10. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | `tests/_fixtures/` の整備（50+ employee fixture）| a-bud | 1.5h |
| 2 | D-02 単体テスト（100+ ケース）| a-bud | 4h（D-02 実装と並行）|
| 3 | D-03 単体テスト（50+ ケース）| a-bud | 2h（D-03 と並行）|
| 4 | D-05 単体テスト（80+ ケース）| a-bud | 3h（D-05 と並行）|
| 5 | D-07 FB データ単体テスト（50+ ケース）| a-bud | 2h（D-07 と並行）|
| 6 | RLS 統合テスト | a-bud | 1.5h |
| 7 | Trx 整合性テスト | a-bud | 1h |
| 8 | PII 暗号化テスト | a-bud | 0.5h |
| 9 | E2E（payroll-full-flow / year-end-flow）| a-bud | 2h |
| 10 | 法令準拠テスト | a-bud | 1.5h |
| 11 | CI パイプライン整備 | a-bud | 0.5h |

合計: 約 19h ≈ 2.4d（D-01〜07 と並行実装で吸収、本 spec 自体の見積は **0.5d** = 戦略書 + fixture 骨格）

---

## 11. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判 1 | 計算系 100% 行カバレッジ強制 | **採用**、PR で下回ったら CI ブロック |
| 判 2 | E2E の DB | **テスト用 Supabase project**（本番分離）|
| 判 3 | 並列実行 | **ファイル単位で並列**、DB トランザクションで isolation |
| 判 4 | snapshot テスト（PDF）| Phase E で導入、当面 unit のみ |
| 判 5 | mutation testing | 採用しない（コスト対効果低）|
| 判 6 | 性能回帰検知 | **3% 以上の遅延で警告**、5% で fail |

---

## 12. 既知のリスクと対策

### 12.1 fixture の保守コスト

- 50+ fixture が肥大化、変更追随困難
- 対策: ファクトリ関数で minimal fixture から派生

### 12.2 法令変更時のテスト追従

- 料率変動・税率改正でテスト一斉失敗
- 対策: 法令テストは **fiscal_year** をパラメータ化、過去年テストは固定

### 12.3 CI 時間の肥大化

- 全テスト 30 分超で開発フロー遅延
- 対策: Pre-commit を絞る、nightly で重テスト

### 12.4 flaky test

- E2E が 10% 程度失敗
- 対策: retry 3 回、原因はその都度修正（permitDurationMs 等）

### 12.5 テストデータと本番との乖離

- 本番特有のエッジケース（過去の例外データ）が test にない
- 対策: 既知のバグを fixture に追加、known-pitfalls 連動

---

## 13. 関連ドキュメント

- `docs/specs/cross-cutting/spec-cross-test-strategy.md`
- `docs/specs/2026-04-25-bud-phase-c-06-test-strategy.md`（Phase C 流儀）
- `docs/specs/2026-04-25-bud-phase-d-{01..07}-*.md`
- `docs/known-pitfalls.md`
- CLAUDE.md §16 リリース前バグ確認（7 種テスト）

---

## 14. 受入基準（Definition of Done）

- [ ] `tests/_fixtures/` に 50+ employee fixture 整備済
- [ ] D-02/03/05/07 各単体テストが目標数以上 pass
- [ ] RLS 統合テスト 7 ロール × 3 テーブル × CRUD 全 pass
- [ ] PII 暗号化テスト pass
- [ ] E2E payroll-full-flow が green
- [ ] 法令準拠テスト全章 pass
- [ ] 計算系（D-02/03/05）の行カバレッジ 100%
- [ ] 全体カバレッジ目標達成（行 90% / 分岐 85% / 関数 95%）
- [ ] CI で PR ごとに自動実行
- [ ] flaky 率 5% 未満
