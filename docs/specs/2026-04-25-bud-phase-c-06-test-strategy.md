# Bud Phase C-06: テスト戦略（Bud 🔴 厳格、金銭・税務関連）

- 対象: Bud Phase C 全機能（C-01 〜 C-05）のテスト計画
- 優先度: **🔴 最高**（金銭・税務関連、誤りは法的トラブルにつながる）
- 見積: **0.9d**（テストコード含む）
- 担当セッション: a-bud
- 作成: 2026-04-25（a-auto 002 / Batch 11 Bud Phase C #06）
- 前提:
  - C-01 〜 C-05 全 spec
  - spec-cross-test-strategy（Batch 7）
  - 親 CLAUDE.md §16 7 種テスト
  - spec-tree-phase-d-06（Tree 🔴 テスト戦略、比較参照）
  - spec-leaf-kanden-phase-c-06（Leaf 🟡 比較参照）

---

## 1. 目的とスコープ

### 目的

Bud Phase C の**現場投入前に**、**§16 7 種テストを Bud 🔴 厳格度**（金銭系最厳格）で完走させ、年末調整〜法定調書提出の一連業務に税務リスクがないことを保証する。

### 含める

- Vitest（ユニット、計算ロジック中心）
- RTL + MSW（統合、ウィザード・確認フロー）
- Playwright（E2E、主要 8 フロー）
- §16 7 種テストの Bud 特化カバー
- 税額計算の境界値テスト（法定義務）
- PDF 出力の帳票テスト（画像比較 + 文字抽出）
- e-Tax XML の schema 検証
- 段階展開計画（α → β → 本番）

### 含めない

- 他モジュールのテスト（Tree D-06 等）
- 手動 UAT（人的テスト、別途計画）
- 負荷テスト（別 spec）

---

## 2. Bud 厳格度

### 2.1 厳格度マトリクス

| モジュール | 厳格度 | 理由 |
|---|---|---|
| Tree | 🔴 最厳格 | コールセンター業務停止級 |
| **Bud** | **🔴 最厳格** | **金銭・税務、誤り = 法的責任** |
| Root | 🔴 最厳格 | 認証・権限、セキュリティ |
| Leaf | 🟡 通常 | データ整合性重視 |
| Forest / Bloom | 🟡 通常 | |
| Soil / Rill / Seed | 🟢 標準 | |

### 2.2 Bud 🔴 カバレッジ目標

| レイヤ | 目標 | 備考 |
|---|---|---|
| Unit（Vitest）| **90%** | 計算ロジックは **100%** 必達 |
| Integration（RTL+MSW）| **75%** | ウィザード・確認フロー |
| E2E（Playwright）| **8 本** | 主要フロー完走 |
| 計算境界値 | **100%** | 税率境界・扶養境界・控除上限等 |
| PDF 出力 | **100%** | 帳票 3 種 × 複数パターン |
| XML schema | **100%** | e-Tax XSD 準拠 |

- Tree 🔴 と同等の基準、ただし **PDF / XML 検証が追加**
- Leaf 🟡 比 +20pp

---

## 3. §16 7 種テストの Bud 具体化

### 3.1 機能網羅テスト（Playwright E2E、8 フロー）

| # | フロー | ステップ数 | 重要度 |
|---|---|---|---|
| 1 | 従業員ウィザード 2 段階 + 添付 + 提出 | 15 | 🔴 |
| 2 | 事務一覧 → 個別確認 → 承認 | 10 | 🔴 |
| 3 | 事務一覧 → 個別確認 → 差戻 → 従業員再提出 | 15 | 🔴 |
| 4 | admin 進捗ダッシュボード + 一括リマインダー | 8 | 🟡 |
| 5 | 源泉徴収票発行 + マイページ表示 + DL | 10 | 🔴 |
| 6 | 支払調書 年次集計 + PDF 発行 | 8 | 🔴 |
| 7 | 法定調書合計表 集計 + CSV エクスポート | 8 | 🔴 |
| 8 | マイナンバー復号（admin+ のみ） | 5 | 🔴 |

### 3.2 エッジケーステスト（Bud 🔴 専用）

金銭系で特に重要な境界：

```typescript
describe('Bud Phase C 金銭エッジケース 🔴', () => {
  // 扶養家族数の境界
  it('扶養家族 0 人 → 控除 0', async () => {});
  it('扶養家族 1 人 → 一般 380,000 円', async () => {});
  it('扶養家族 10 人 → 上限なし（現実的範囲）', async () => {});

  // 配偶者特別控除の境界（9 段階）
  it('配偶者所得 48 万円 → 満額控除', async () => {});
  it('配偶者所得 95 万円 → 満額控除', async () => {});
  it('配偶者所得 100 万円 → 控除減額', async () => {});
  it('配偶者所得 133 万円 → 控除 0', async () => {});
  it('配偶者所得 133 万 1 円 → 控除 0', async () => {});

  // 給与所得控除の境界
  it('年収 162.5 万円 → 控除 55 万円（最低保証）', async () => {});
  it('年収 162.6 万円 → 収入 × 40% - 10 万円', async () => {});
  it('年収 850 万円 → 控除額', async () => {});
  it('年収 850 万 1 円 → 控除 195 万円（上限）', async () => {});

  // 源泉徴収税率の境界
  it('源泉 100 万円 → 10.21%', async () => {});
  it('源泉 100 万 1 円 → 100 万までは 10.21%、超過 20.42%', async () => {});

  // 中途退職者
  it('前職給与あり（中途入社者）', async () => {});
  it('年末退職者（12/31 退職）', async () => {});
  it('年中退職者（6/30 退職）→ 年末調整対象外', async () => {});

  // 住宅ローン
  it('住宅ローン 2 年目 → 年末調整で控除', async () => {});
  it('住宅ローン 1 年目 → 確定申告（対象外）', async () => {});

  // 添付エッジ
  it('添付 0 件で提出 → 扶養控除のみで控除なし', async () => {});
  it('添付 20 枚上限', async () => {});
  it('添付 heic → jpg 自動変換', async () => {});

  // 文字エッジ
  it('氏名に 旧字体（髙、渡邉 等）', async () => {});
  it('住所に 絵文字 → PDF でエラーハンドリング', async () => {});
  it('備考 1000 文字 → 切り捨て表示', async () => {});
});
```

### 3.3 権限テスト（8 階層）

```typescript
describe('Bud Phase C 権限テスト', () => {
  // Garden 8-role 標準: toss / closer / cs / staff / outsource / manager / admin / super_admin
  const roles = ['toss', 'closer', 'cs', 'staff', 'outsource', 'manager', 'admin', 'super_admin'];

  roles.forEach(role => {
    describe(`role: ${role}`, () => {
      // 従業員 as toss
      it('自分の年末調整 SELECT 可', async () => {});
      it('他人の年末調整 SELECT 不可（staff 未満）', async () => {});
      it('確定済の UPDATE 不可（本人）', async () => {});

      // staff
      it('全従業員 SELECT 可（staff 以上）', async () => {});
      it('事務承認 可（staff 以上）', async () => {});

      // manager
      it('manager UI で部署フィルタ', async () => {});

      // admin+
      it('マイナンバー復号 可（admin+）', async () => {});
      it('確定後の unlock 可（admin+）', async () => {});
      it('法定調書合計表 submit 可（admin+）', async () => {});
    });
  });
});
```

### 3.4 データ境界テスト

| 境界 | テスト | 期待 |
|---|---|---|
| 年度跨ぎ | 12/31 提出 vs 1/1 提出 | 正しい年度に紐付け |
| 扶養 0 / 1 / 10 | 控除額 | 段階的増加、上限なし |
| 配偶者所得 48/95/133 万 | 特別控除段階 | 9 段階正しく適用 |
| 社保 上限 | 月額 139 万円超過時 | 上限で頭打ち |
| マイナンバー形式 | 12 桁正 / 11 桁 / 13 桁 | 12 桁のみ受理 |
| 添付ファイル | 5MB ちょうど / 5.1MB | Canvas 圧縮で収まる |

### 3.5 パフォーマンス計測

| シナリオ | 指標 | 目標 |
|---|---|---|
| 従業員ウィザード表示 | LCP | < 2.5s |
| Step 遷移 | トランジション | < 300ms |
| 添付アップロード 5MB | 完了時間 | < 5s |
| 事務一覧 120 人 | 初回表示 | < 1s |
| 個別モーダル表示 | 初回表示 | < 500ms |
| admin 進捗 polling | 1 回 | < 300ms |
| 源泉徴収票 PDF 生成 1 人 | 生成時間 | < 2s |
| 源泉徴収票 100 人並列 | 完了時間 | < 1min |
| CSV エクスポート 1000 行 | 応答 | < 3s |
| 法定調書 XML 生成 | 完了時間 | < 10s |

### 3.6 コンソールエラー監視

- E2E 中に `console.error` 検出 → テスト失敗
- Supabase 401/403 Forbidden も検出対象（RLS エラー検知）

### 3.7 アクセシビリティ

- axe-core violations 0（全画面）
- Lighthouse Accessibility **95 以上**（Tree 🔴 同等）
- キーボードのみでウィザード完走
- スクリーンリーダー: 計算結果・還付額の読み上げ確認

---

## 4. PDF 帳票テスト

### 4.1 生成テスト

```typescript
describe('PDF 帳票テスト', () => {
  it('源泉徴収票 1 人分生成 + sha256 計算', async () => {
    const pdf = await generateGensenChoshuPDF(mockData);
    expect(pdf.length).toBeGreaterThan(10_000);
    const hash = sha256(pdf);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('A6 サイズ検証', async () => {
    const pdf = await generateGensenChoshuPDF(mockData);
    const pdfDoc = await PDFLib.PDFDocument.load(pdf);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();
    expect(width).toBeCloseTo(297, 0);   // A6 横向き 148.5mm × 2
    expect(height).toBeCloseTo(210, 0);
  });
});
```

### 4.2 画像比較テスト（Visual Regression）

- 既知の「正解 PDF」を `tests/fixtures/pdf-golden/` に保存
- 新生成との pixel diff を `pixelmatch` で比較
- しきい値: 0.05% diff 以下で合格
- 対象:
  - 源泉徴収票 × 3 パターン（通常 / 扶養多 / 住宅ローンあり）
  - 支払調書 × 2 パターン（個人 / 法人）
  - 法定調書サマリ PDF

### 4.3 文字抽出テスト（`pdf-parse`）

```typescript
import pdf from 'pdf-parse';

it('源泉徴収票から必須文字列を抽出', async () => {
  const buffer = await generateGensenChoshuPDF(mockData);
  const data = await pdf(buffer);
  expect(data.text).toContain('令和');
  expect(data.text).toContain('給与所得の源泉徴収票');
  expect(data.text).toContain('山田太郎');
  expect(data.text).toContain('¥4,800,000');
});
```

---

## 5. XML スキーマ検証

### 5.1 XSD ファイル配置

```
tests/fixtures/xsd/
├── htns200-2026.xsd   ← 令和 8 年分スキーマ
└── htns200-2027.xsd   ← 令和 9 年分スキーマ
```

### 5.2 検証ロジック

```typescript
import { validateXML } from 'libxmljs2';

it('法定調書合計表 XML が XSD 準拠', async () => {
  const xml = await generateHoteiChoshoXML(2026, mockSummary);
  const xsd = await fs.readFile('tests/fixtures/xsd/htns200-2026.xsd', 'utf-8');
  const errors = validateXML(xml, xsd);
  expect(errors).toEqual([]);
});
```

### 5.3 業務ルール検証

- 合計金額の整合性（detail の sum = summary の値）
- マイナンバー 12 桁 / 法人番号 13 桁
- 日付フォーマット（YYYY-MM-DD）
- 空要素の扱い（0 と null の区別）

---

## 6. テストコード構成

### 6.1 ディレクトリ

```
src/app/bud/
├── _lib/
│   └── __tests__/
│       ├── tax/
│       │   ├── calcIncomeDeduction.test.ts
│       │   ├── calcWithholdingTax.test.ts
│       │   ├── salarySlabTable.test.ts
│       │   └── kaiguTokubetsuTable.test.ts
│       ├── nenmatsu/
│       │   ├── yearBoundary.test.ts
│       │   └── statusTransition.test.ts
│       └── gensen/
│           ├── aggregateAnnual.test.ts
│           └── myNumberCrypto.test.ts
│
├── nenmatsu-chousei/
│   └── __tests__/
│       └── wizard.test.tsx           (RTL + MSW)
│
├── backoffice/
│   └── nenmatsu/__tests__/
│       ├── list.test.tsx
│       └── detail-modal.test.tsx
│
└── admin/nenmatsu-progress/__tests__/
    └── dashboard.test.tsx

tests/e2e/bud/phase-c/
├── employee-wizard-flow.spec.ts
├── staff-approval-flow.spec.ts
├── reject-resubmit-flow.spec.ts
├── admin-progress-flow.spec.ts
├── gensen-choshu-issue-flow.spec.ts
├── shiharai-chosho-flow.spec.ts
├── hotei-chosho-flow.spec.ts
└── my-number-decrypt-flow.spec.ts
```

### 6.2 Vitest config（Bud 🔴 専用）

```typescript
// vitest.config.bud.ts
export default defineConfig({
  test: {
    include: ['src/app/bud/**/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
      // 計算ロジックは 100% 必達
      perFile: {
        'src/app/bud/_lib/tax/*.ts': {
          lines: 100,
          branches: 100,
        },
      },
    },
    setupFiles: ['./tests/setup-bud-db.ts'],
  },
});
```

### 6.3 Playwright config

```typescript
projects: [
  {
    name: 'bud-phase-c',
    testDir: './tests/e2e/bud/phase-c',
    use: {
      baseURL: process.env.BUD_TEST_BASE_URL,
    },
    retries: 2,  // 🔴 Bud は 2 リトライ
    timeout: 60 * 1000,
  },
];
```

---

## 7. 段階展開計画

### 7.1 3 段階

| 段階 | 対象 | 期間 | 判定基準 |
|---|---|---|---|
| α版 | 東海林さん 1 人（ダミーデータで完走）| 1 週間 | 7 種テスト完走 + 正解 PDF 生成 |
| β版 | 経理担当者 2-3 人（実データ 10 人分）| 2 週間 | 誤計算 0、誤差 < 1 円 |
| 本番 | 全従業員 120 人 | 11-12 月の 2 ヶ月 | 法定期限 1/31 までに全件確定 |

### 7.2 α版の範囲

- 東海林さんの個人データ + ダミーデータ 9 人分
- 給与データは開発環境の仮データ
- PDF 生成 → 目視確認（正解データとの突合）
- マイナンバー復号機能の動作確認

### 7.3 β版の要件

- **税理士事務所と連携**
  - 出力 CSV を税理士に提示
  - 例年との差分確認
  - 指摘事項を修正
- 10 人分の実データで試算
- 旧システム（手書き or Excel）との結果突合

### 7.4 本番投入判断

- β版で **誤計算 0 / 誤差 < 1 円** が 3 日連続で確認
- admin + 東海林さん + 税理士事務所の **3 者合意**
- ロールバック計画準備完了

---

## 8. ロールバック計画

### 8.1 事例別対応

| 事例 | 対応 |
|---|---|
| 計算誤り発覚 | マスタテーブル修正 → 再集計バッチ → 差戻通知 |
| PDF 出力不備 | `reissue_count` で再発行、旧 void |
| 税務署提出済後の訂正 | `amended` 状態で再生成・再提出 |
| 大規模障害 | admin 緊急モード → 全員手動対応 + Excel fallback |

### 8.2 緊急時の Excel fallback

- 税理士事務所既存 Excel 様式を `tests/fixtures/fallback/` に保持
- Garden ダウン時は Excel 入力 → 後日 Garden に一括投入

---

## 9. 金銭テストの特殊ルール

### 9.1 必ず実装すべき検証

- **端数処理**: 源泉税は円未満切捨（`Math.floor`）、給与所得控除は円未満切上（`Math.ceil`）等、計算ごと定義済
- **合計検算**: 明細合計 = サマリ総額（±0 円の完全一致）
- **逆算検証**: 総支給 - 控除合計 = 差引支給、再計算で一致

### 9.2 金額フォーマットテスト

```typescript
it('金額表示フォーマット', () => {
  expect(formatYen(1234567)).toBe('¥1,234,567');
  expect(formatYen(0)).toBe('¥0');
  expect(formatYen(-1234)).toBe('-¥1,234');
  expect(formatYen(undefined)).toBe('—');  // 未設定
});
```

### 9.3 禁止事項

- **Float 計算禁止**: `0.1 + 0.2 !== 0.3` 問題回避
- すべて `number`（整数）で扱う、円単位で保存
- 比率計算は `Math.floor(gross * 1021 / 10000)` のように整数演算

---

## 10. CI 設定

### 10.1 ブロック条件

以下で PR マージブロック:

- Vitest カバレッジ 90% 未達
- 計算ロジックカバレッジ 100% 未達
- PDF Visual Regression 失敗
- XML XSD 検証失敗
- E2E 8 本中 1 本失敗
- axe violations > 0

### 10.2 実行スケジュール

| タイミング | テスト |
|---|---|
| PR push | Vitest + RTL |
| PR `bud-c-ready` ラベル | Playwright（dev）|
| develop merge | 全テスト + dev staging smoke |
| 月次 11/25 | 全 E2E + 税理士事務所出力検証 |

---

## 11. 実装ステップ

1. **Step 1**: Vitest 設定分離（bud 🔴 用）+ 計算ロジックテスト 12 本（2h）
2. **Step 2**: RTL 統合テスト（ウィザード + 確認モーダル）（1.5h）
3. **Step 3**: E2E 8 本作成（Playwright）（3h）
4. **Step 4**: PDF Visual Regression + 文字抽出（1.5h）
5. **Step 5**: XML XSD 検証（1h）
6. **Step 6**: axe-core + Lighthouse CI（0.5h）
7. **Step 7**: 段階展開計画の手順書起草（0.5h）
8. **Step 8**: 全テスト完走確認・ドキュメント化（1h）

**合計**: 約 **0.9d**（約 11h）

---

## 12. 判断保留事項

- **判1: PDF Visual Regression のツール**
  - pixelmatch / resemble.js / Chromatic
  - **推定スタンス**: pixelmatch（軽量、自前 CI）
- **判2: XSD ファイルの入手元**
  - 国税庁公式 DL / 税理士事務所経由
  - **推定スタンス**: 顧問税理士経由で最新版入手
- **判3: 計算ロジック 100% カバレッジの緩和**
  - 税制改正で一時的に未達になる場合
  - **推定スタンス**: 90% 下限で警告、100% 未達は admin 判断でマージ許可
- **判4: 本番データでのテスト禁止**
  - dev 環境のみ / staging 環境作成
  - **推定スタンス**: staging 作成（Supabase dev 環境とは別）
- **判5: マイナンバー の テスト用ダミー値**
  - 規則的な値 / ランダム値
  - **推定スタンス**: 規則的な値（`1234-5678-9012` 等）、ただし**実在チェック必須**（重複しないこと）
- **判6: Playwright 並列数**
  - 1 / 4 / 8
  - **推定スタンス**: 4（多すぎると税計算の race 条件発生懸念）
- **判7: e-Tax 本番接続テスト**
  - テスト送信 / 本番送信
  - **推定スタンス**: 税理士事務所立会いのもと本番送信のみ（事前テスト送信は不可）

---

## 13. まとめ: Bud Phase C 累計工数

| spec | 実装見込 |
|---|---|
| C-01 schema | 0.6d |
| C-02 gensen-choshu | 0.6d |
| C-03 shiharai-chosho | 0.6d |
| C-04 hotei-chosho-goukei | 0.6d |
| C-05 UI | 0.8d |
| **C-06 test-strategy** | **0.9d** |
| **合計** | **約 4.1d** |

- Batch 11 起草時見込 3.5d → 実見積 4.1d（+0.6d）
- テスト戦略（Tree D-06 と同等 🔴 厳格）+ PDF/XML 検証で +0.3d
- UI の 3 者対応で +0.3d

---

## 14. テスト優先順位

### 14.1 必須（α版前に完走）

- 計算ロジック 100% カバレッジ（税額・控除・源泉）
- PDF 生成 Visual Regression（源泉徴収票・支払調書）
- RLS 権限テスト
- マイナンバー暗号化・復号

### 14.2 β版前に追加

- E2E 8 本完走
- XML XSD 検証
- admin 進捗 polling
- モバイル対応（従業員ウィザードのみ）

### 14.3 本番前に追加

- 税理士事務所との結果突合
- 旧システム比較検証
- 本番データでの試算（staging 環境）

---

— spec-bud-phase-c-06 end —
