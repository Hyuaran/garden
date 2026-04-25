# Cross History #06: テスト戦略（Trigger / RLS / UI / 性能）

- 対象: Batch 14 全 spec（#01-05）のテスト計画
- 優先度: **🔴 最高**（横断基盤、全モジュール影響）
- 見積: **0.2d**
- 担当セッション: a-main + 各モジュール
- 作成: 2026-04-25（a-auto 002 / Batch 14 Cross History #06）
- 前提:
  - Cross History #01-05
  - spec-cross-test-strategy（Batch 7、横断厳格度マトリクス）
  - 親 CLAUDE.md §16 7 種テスト

---

## 1. 目的とスコープ

### 目的

横断履歴・削除基盤の **Trigger 動作 / RLS / UI / 性能** を網羅的に検証し、9 モジュールへの統合前に品質を担保する。

### 含める

- Trigger の動作確認（5 種類の operation）
- RLS の権限テスト（閲覧 / 改ざん防止）
- UI コンポーネントの RTL テスト
- 大量データでの性能（100 万行規模）
- §16 7 種テストの適合性
- モジュール統合後の回帰テスト

### 含めない

- 各モジュールの個別テスト（各モジュール spec 内）
- ユーザー受入テスト（UAT）

---

## 2. テスト範囲と厳格度

### 2.1 テスト対象

| spec | テスト範囲 | 厳格度 |
|---|---|---|
| #01 data-model | Trigger / パーティション | 🔴 最高 |
| #02 RLS | 権限テスト 7 役割 | 🔴 最高 |
| #03 sidebar | UI コンポーネント | 🟡 通常 |
| #04 delete-pattern | UI + 動作 | 🟡 通常 |
| #05 module-integration | 統合テスト | 🟡 通常 |

### 2.2 カバレッジ目標

| レイヤ | 目標 |
|---|---|
| Trigger 関数 | **100%**（業務影響大）|
| RLS ポリシー | **100%**（セキュリティ）|
| UI コンポーネント | 80% |
| 統合（モジュール × 履歴）| 70% |

---

## 3. Trigger テスト

### 3.1 5 種 operation の網羅

```typescript
describe('garden_change_history Trigger', () => {
  describe('INSERT', () => {
    it('レコード新規作成時に operation=INSERT が記録される', async () => {
      const { case_id } = await supabase.from('soil_kanden_cases').insert({...});
      const history = await fetchHistory({ tableName: 'soil_kanden_cases', recordId: case_id });
      expect(history).toHaveLength(1);
      expect(history[0].operation).toBe('INSERT');
    });
  });

  describe('UPDATE', () => {
    it('1 列変更時に 1 行記録', async () => {
      await supabase.from('soil_kanden_cases').update({ status: 'submitted' }).eq('case_id', id);
      const history = await fetchHistory(...);
      expect(history.find(h => h.operation === 'UPDATE')).toBeDefined();
      expect(history[0].field_name).toBe('status');
      expect(history[0].old_value).toBe('ordered');
      expect(history[0].new_value).toBe('submitted');
    });

    it('複数列同時変更で複数行記録、同じ request_id', async () => {
      await supabase.from('soil_kanden_cases').update({
        status: 'submitted', customer_name: '新名前'
      }).eq('case_id', id);
      const history = await fetchHistory(...);
      const updateRows = history.filter(h => h.operation === 'UPDATE');
      expect(updateRows).toHaveLength(2);
      expect(updateRows[0].request_id).toBe(updateRows[1].request_id);
    });
  });

  describe('SOFT_DELETE', () => {
    it('deleted_at NULL → 値設定で SOFT_DELETE が記録', async () => {
      await supabase.from('soil_kanden_cases').update({ deleted_at: new Date() }).eq('case_id', id);
      const history = await fetchHistory(...);
      expect(history.find(h => h.operation === 'SOFT_DELETE')).toBeDefined();
    });
  });

  describe('RESTORE', () => {
    it('deleted_at 値 → NULL で RESTORE が記録', async () => { /* ... */ });
  });

  describe('DELETE (物理)', () => {
    it('物理削除時に operation=DELETE が記録', async () => { /* ... */ });
  });
});
```

### 3.2 値型ヒントの正確性

```typescript
it('value_type が正しく設定される', async () => {
  await supabase.from('bud_transfers').update({ amount: 12000 }).eq('id', id);
  const history = await fetchHistory(...);
  expect(history[0].value_type).toBe('number');
});
```

### 3.3 Trigger の冪等性

```typescript
it('同じ UPDATE を 2 回しても履歴は 1 回（差分なし）', async () => {
  await supabase.from(...).update({ status: 'submitted' }).eq(...);
  const before = (await fetchHistory(...)).length;
  await supabase.from(...).update({ status: 'submitted' }).eq(...);  // 同じ値
  const after = (await fetchHistory(...)).length;
  expect(after).toBe(before);  // 差分なし、履歴増えない
});
```

---

## 4. RLS テスト

### 4.1 改ざん防止

```typescript
describe('garden_change_history 改ざん防止', () => {
  it('admin でも UPDATE できない', async () => {
    await login('admin');
    const result = await supabase.from('garden_change_history')
      .update({ new_value: '改ざん' })
      .eq('history_id', 1);
    expect(result.error).toBeDefined();
  });

  it('super_admin でも DELETE できない', async () => {
    await login('super_admin');
    const result = await supabase.from('garden_change_history')
      .delete()
      .eq('history_id', 1);
    expect(result.error).toBeDefined();
  });

  it('Trigger 経由のみ INSERT 可能', async () => {
    // 直接 INSERT 試行（app.via_trigger 設定なし）
    const result = await supabase.from('garden_change_history').insert({...});
    expect(result.error).toBeDefined();
  });
});
```

### 4.2 権限階層

```typescript
describe('garden_change_history SELECT 権限', () => {
  const roles = ['toss', 'closer', 'cs', 'staff', 'manager', 'admin', 'super_admin'];

  roles.forEach(role => {
    describe(`role: ${role}`, () => {
      it('自分の操作履歴は SELECT 可', async () => { /* ... */ });
      it('他人の関電案件履歴: business スコープ内なら SELECT 可', async () => { /* ... */ });
      it('他人の Bud 振込履歴: 本人 + staff+ のみ', async () => { /* ... */ });
      if (['admin', 'super_admin'].includes(role)) {
        it('全モジュール横断履歴 SELECT 可', async () => { /* ... */ });
      } else {
        it('admin 専用領域は SELECT 不可', async () => { /* ... */ });
      }
    });
  });
});
```

### 4.3 PII マスキング

```typescript
it('PII 列の old_value / new_value が暗号化されている', async () => {
  await supabase.from('bud_gensen_choshu').update({ recipient_my_number: '1234-5678-9012' }).eq(...);
  const history = await supabase.from('garden_change_history').select('*').limit(1).single();
  expect(history.new_value).not.toBe('1234-5678-9012');  // 平文ではない
  expect(history.new_value).toMatch(/^\\x/);  // 暗号化済の prefix
});

it('admin の復号関数で平文取得可能', async () => {
  await login('admin');
  const result = await supabase.rpc('decrypt_history_value', { p_history_id: 1 });
  expect(result).toBe('1234-5678-9012');
});

it('staff は復号関数を呼べない', async () => {
  await login('staff');
  const result = await supabase.rpc('decrypt_history_value', { p_history_id: 1 });
  expect(result.error).toMatch(/Only admin/);
});
```

---

## 5. UI コンポーネントテスト（RTL）

### 5.1 ChangeHistorySidebar

```tsx
describe('<ChangeHistorySidebar>', () => {
  it('閉じた状態で開閉ボタンのみ表示', () => {
    render(<ChangeHistorySidebar module="bud" tableName="bud_transfers" recordId="1" />);
    expect(screen.queryByText(/変更履歴/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /履歴を開く/i })).toBeInTheDocument();
  });

  it('開閉ボタンクリックで開く', async () => {
    render(<ChangeHistorySidebar ... />);
    await userEvent.click(screen.getByRole('button', { name: /履歴を開く/i }));
    expect(screen.getByText(/変更履歴/)).toBeInTheDocument();
  });

  it('履歴データを取得して表示', async () => {
    server.use(
      http.get('/api/history', () => HttpResponse.json([{ /* ... */ }]))
    );
    render(<ChangeHistorySidebar ... initialOpen />);
    await screen.findByText(/2026-04-25/);
  });

  it('フィルタ変更で再取得', async () => {
    render(<ChangeHistorySidebar ... initialOpen />);
    await userEvent.click(screen.getByText(/30 日/));
    await waitFor(() => expect(server.requests).toHaveLength(2));
  });

  it('UPDATE の diff 表示', async () => {
    render(...);
    expect(screen.getByText(/旧:.*山田太朗/)).toBeInTheDocument();
    expect(screen.getByText(/新:.*山田太郎/)).toBeInTheDocument();
  });

  it('SOFT_DELETE は赤背景 + 取消線', async () => {
    render(...);
    const deleteItem = screen.getByText(/論理削除/).parentElement;
    expect(deleteItem).toHaveClass('bg-red-50');
  });
});
```

### 5.2 DeleteButton

```tsx
describe('<DeleteButton>', () => {
  it('クリックで確認モーダル表示', async () => {
    render(<DeleteButton onDelete={jest.fn()} recordName="案件 #001" />);
    await userEvent.click(screen.getByRole('button', { name: /削除/ }));
    expect(screen.getByText(/案件 #001 を削除/)).toBeInTheDocument();
  });

  it('権限不足で disabled', () => {
    render(<DeleteButton permissionLevel="admin+" /* user is staff */ />);
    expect(screen.getByRole('button', { name: /削除/ })).toBeDisabled();
  });

  it('削除実行後に UndoSnackbar 表示', async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    render(<DeleteButton onDelete={onDelete} ... />);
    await userEvent.click(...); // 削除実行
    await screen.findByText(/元に戻す/);
  });

  it('UndoSnackbar クリックで onUndo 呼び出し', async () => { /* ... */ });

  it('5 秒後に Snackbar 自動消失', async () => { /* timer */ });
});
```

### 5.3 DeletedBadge

```tsx
describe('<DeletedBadge>', () => {
  it('deletedAt あれば表示', () => {
    render(<DeletedBadge deletedAt={new Date('2026-04-25')} />);
    expect(screen.getByText(/削除済/)).toBeInTheDocument();
  });

  it('ホバーでツールチップ表示', async () => {
    render(<DeletedBadge deletedAt={...} deletedBy="山田太郎" reason="重複" />);
    await userEvent.hover(screen.getByText(/削除済/));
    expect(await screen.findByText(/山田太郎/)).toBeInTheDocument();
  });
});
```

---

## 6. 性能テスト

### 6.1 大量データ前提

dev 環境に **100 万行 のテストデータ**を seed:

```sql
INSERT INTO garden_change_history (module, table_name, record_id, operation, field_name, old_value, new_value, changed_at, changed_by)
SELECT
  'bud',
  'bud_transfers',
  uuid_generate_v4()::text,
  'UPDATE',
  'amount',
  (random() * 100000)::int::text,
  (random() * 100000)::int::text,
  now() - (random() * interval '7 years'),
  'emp0001'
FROM generate_series(1, 1000000);
```

### 6.2 性能目標

| クエリ | 目標 | 計測 |
|---|---|---|
| 単一レコード履歴取得（50 件）| < 100ms | EXPLAIN ANALYZE |
| 全モジュール最近履歴（admin）| < 500ms | EXPLAIN ANALYZE |
| ユーザー別履歴（30 日） | < 200ms | EXPLAIN ANALYZE |
| パーティション境界跨ぎ | < 300ms | EXPLAIN ANALYZE |
| Trigger 実行（1 UPDATE）| < 50ms | pg_stat_statements |

### 6.3 負荷テスト

k6 で同時接続テスト:

```js
// tests/load/history-write.js
import http from 'k6/http';
export const options = { vus: 50, duration: '5m' };
export default function() {
  http.put(`${BASE}/api/transfers/${randomId()}`, { amount: random() });
}
```

100 万行 + 50 同時更新で:

- p95 レスポンス < 500ms
- エラー率 < 1%

---

## 7. §16 7 種テストの適合性

### 7.1 1. 機能網羅

- 5 operation × 9 モジュール = 45 ケース
- Playwright E2E で代表 5 ケース実施

### 7.2 2. エッジケース

- field_name 空欄
- value_type 未対応型（bytea 等）
- 5,000 文字超の値（切り詰め）
- 1 つの UPDATE で 100 列変更
- 同一 record の連続 UPDATE 1 秒間 100 回

### 7.3 3. 権限

7 役割 × 5 操作 = 35 ケース（§4.2 で実施）

### 7.4 4. データ境界

- changed_at 過去・未来極値
- 日跨ぎ・年跨ぎ
- パーティション境界

### 7.5 5. パフォーマンス

§6 で実施

### 7.6 6. コンソールエラー

UI 操作中の `console.error` 検出

### 7.7 7. アクセシビリティ

- ChangeHistorySidebar の axe violations 0
- キーボード操作完走

---

## 8. 統合テスト

### 8.1 モジュール統合の代表テスト

```typescript
describe('Bud × History 統合', () => {
  it('振込更新で Bud 詳細ページの履歴に反映', async () => {
    await page.goto('/bud/transfers/123');
    await page.click('[data-testid="open-history"]');

    const initialCount = await page.locator('[data-testid="history-item"]').count();

    // 別タブで更新
    await page.context().request.put('/api/transfers/123', { data: { amount: 12000 } });

    // 履歴サイドバーを再取得
    await page.click('[data-testid="refresh-history"]');
    const newCount = await page.locator('[data-testid="history-item"]').count();
    expect(newCount).toBe(initialCount + 1);
  });
});
```

### 8.2 9 モジュール × 履歴記録

各モジュールで代表的な操作を実施し、履歴記録を確認。

---

## 9. CI 統合

### 9.1 GitHub Actions

```yaml
# .github/workflows/test-history.yml
name: Cross History Tests

on: [pull_request]

jobs:
  trigger-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: npm test -- tests/history/trigger.test.ts
      - run: npm test -- tests/history/rls.test.ts

  ui-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: npm test -- tests/components/history/

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: npx playwright install
      - run: npm run test:e2e
```

### 9.2 ブロック条件

- Trigger テスト失敗 → マージ拒否
- RLS テスト失敗 → マージ拒否
- カバレッジ Trigger/RLS 100% 未達 → 警告（PR コメント）

---

## 10. 段階的展開と回帰テスト

### 10.1 各 Phase 後の回帰テスト

#05 §5.1 の Phase 別:

```
Phase 1（基盤）→ 全テスト実施
Phase 2（軽量モジュール）→ Bloom/Soil/Rill/Seed の統合テスト
Phase 3（中規模）→ Tree/Forest/Leaf の統合テスト
Phase 4（大型）→ Bud/Root の統合テスト
```

各 Phase 後、Phase 1 の全テスト + 当該 Phase の統合テストを実施。

### 10.2 性能回帰テスト

各 Phase で k6 負荷テスト再実行、p95 が 10% 以上劣化したらリリースブロック。

---

## 11. 実装ステップ（テスト準備）

1. **Step 1**: Trigger 単体テスト 5 operation × 確認パターン（1.5h）
2. **Step 2**: RLS テスト（権限階層 + 改ざん防止）（1h）
3. **Step 3**: UI RTL テスト 3 コンポーネント（1.5h）
4. **Step 4**: 性能テスト基盤（seed + k6 シナリオ）（0.5h）
5. **Step 5**: 統合テスト 9 モジュール代表（1h）
6. **Step 6**: CI workflow 設定（0.5h）

**合計**: 約 **0.2d**（約 6h、テスト基盤のみ、各テスト実装は別工数）

実際のテストコード実装は **0.5d-1.0d** 別途。

---

## 12. 判断保留事項

- **判1: 性能テストの実環境**
  - Supabase dev / staging 専用 / ローカル
  - **推定スタンス**: staging 専用環境（dev に影響しない）
- **判2: 100 万行 seed の更新頻度**
  - 月次 / リリース毎
  - **推定スタンス**: リリース毎（最新性確保）
- **判3: k6 同時接続数**
  - 50 / 100 / 500
  - **推定スタンス**: 50（実運用想定）、500 はストレステスト
- **判4: パーティション境界テストの自動化**
  - 月次境界・年次境界の自動テスト
  - **推定スタンス**: 月次のみ（年次は年 1 回手動）
- **判5: PII 暗号化テストの dev 環境**
  - ダミー鍵 / 本番鍵流用
  - **推定スタンス**: ダミー鍵（本番鍵はステージング以降）
- **判6: 統合テストの retrofit タイミング**
  - モジュール統合と同時 / 後追い
  - **推定スタンス**: 同時（リリース前に必須）

---

## 13. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| Trigger 単体テスト | 1.5h |
| RLS テスト | 1.0h |
| UI RTL テスト | 1.5h |
| 性能テスト基盤 | 0.5h |
| 統合テスト | 1.0h |
| CI 設定 | 0.5h |
| **合計（テスト準備）** | **0.2d**（約 6h）|

実テスト実装: 別途 0.5-1.0d

---

## 14. まとめ: Batch 14 累計工数

| spec | 実装見積 |
|---|---|
| #01 data-model | 0.4d |
| #02 RLS | 0.3d |
| #03 sidebar | 0.4d |
| #04 delete-pattern | 0.4d |
| #05 module-integration | 0.3d |
| **#06 test-strategy** | **0.2d** |
| **基盤合計** | **2.0d** |
| 9 モジュール統合 | 7.0d |
| **総合計** | **約 9.0d** |

> Batch 14 起草時見込 2.0d spec / 4.0d 実装 → spec 2.0d / 基盤実装 2.0d / 統合 7.0d = 計 11.0d
> 想定より 9 モジュール統合工数大、ただし各モジュール独立で並列化可能

---

— spec-cross-history-06 end —
