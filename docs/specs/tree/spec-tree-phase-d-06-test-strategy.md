# Tree Phase D-06: テスト戦略（Tree 厳格度 🔴 最厳格）

- 対象: Tree Phase D 全機能（D-01 〜 D-05）のテスト計画
- 優先度: **🔴 最高**（Tree = 🔴 最厳格、FileMaker 切替失敗は業務停止級）
- 見積: **1.0d**（テストコード作成含む）
- 担当セッション: a-tree
- 作成: 2026-04-25（a-auto / Batch 9 Tree Phase D #06）
- 前提:
  - D-01 〜 D-05 の全 spec
  - spec-cross-test-strategy（Batch 7）
  - 親 CLAUDE.md §16 7 種テスト / §17 現場フィードバック / §18 Phase D 最慎重
  - spec-leaf-kanden-phase-c-06-test-strategy（Leaf 🟡 版、比較参照）

---

## 1. 目的とスコープ

### 目的

Tree Phase D の**現場投入前に**、**§16 7 種テストを Tree 厳格度 🔴 最厳格**で完走させ、**§17 5 段階展開**（α → 1 人 → 2-3 人 → 半数 → 全員）を着実に進めるためのテスト基盤を整える。

### 含める

- Vitest（ユニット、`_lib/` + 純関数）
- RTL + MSW（統合、Client Component × Supabase）
- Playwright（E2E、主要フロー 10 本）
- §16 7 種テストの Tree 特化カバー
- §17 5 段階展開の具体手順
- FileMaker 並行運用中の切替判断基準
- ロールバック計画（FM 即時切り戻し）

### 含めない

- 負荷試験ツール選定（§判断保留）
- A/B テスト（FM vs Garden 統計検証は §7 で触れる）

---

## 2. Tree 厳格度の設定

### 2.1 spec-cross-test-strategy 位置付け

| モジュール | 厳格度 |
|---|---|
| **Tree / Bud / Root** | **🔴 最厳格** |
| Leaf | 🟡 通常 |
| Forest / Bloom | 🟡 通常 |
| Soil / Rill / Seed | 🟢 標準 |

### 2.2 Tree 🔴 最厳格のカバレッジ目標

| レイヤ | 対象 | 目標 |
|---|---|---|
| Unit（Vitest）| `src/app/tree/_lib/` + `_constants/` + 計算ロジック | **85%** |
| Integration（RTL+MSW）| 主要 Component × Supabase | **75%** |
| E2E（Playwright）| 主要 10 フロー | **10 本**の完走 |
| 境界値 | result_code 全種・時刻境界・文字コード | **100%**（Tree 特有） |

- Leaf 🟡 より厳しい（カバレッジ +15pp）
- 境界値 100% は Tree 専用ルール（誤結果が業績に直結するため）

---

## 3. §16 7 種テストの Tree 具体化

### 3.1 機能網羅テスト（Playwright E2E）

| 対象フロー | ケース数 | 重要度 |
|---|---|---|
| ログイン → キャンペーン選択 → セッション open | 5 種 | 🔴 |
| Sprout 結果ボタン 10 種 × 押下後 INSERT | 10 種 | 🔴 |
| Branch 結果ボタン 11 種 × 押下後 INSERT | 11 種 | 🔴 |
| 巻き戻し（5 秒以内成功）| 1 種 | 🔴 |
| 巻き戻し（5 秒超過で拒否）| 1 種 | 🔴 |
| ショートカット F1-F10 × 10 種 | 10 種 | 🔴 |
| トスアップ 2 段階ウィザード（D-04）| 5 種 | 🔴 |
| セッション close → ダッシュボード反映 | 2 種 | 🟡 |
| マネージャーダッシュボード表示（30s polling）| 3 種 | 🟡 |
| KPI 画面（日/週/月 切替）| 3 種 | 🟢 |

### 3.2 エッジケーステスト

Tree 特化で**超重要**：

```typescript
describe('Tree エッジケース 🔴', () => {
  it('空入力: メモ空欄で結果 INSERT 成功', async () => {});
  it('極大入力: メモ 500 文字で INSERT 成功', async () => {});
  it('極大入力: メモ 501 文字で警告表示 + truncate', async () => {});
  it('特殊文字: メモに絵文字 🎉 含めて INSERT', async () => {});
  it('マルチバイト: メモに 全角記号「◎△×」 含めて INSERT', async () => {});
  it('顧客名: 姓名 255 文字ギリギリ', async () => {});
  it('電話番号: ハイフン有無 / 全角半角混在', async () => {});
  it('オフライン: ネット断中に 50 結果 INSERT → 復帰時 flush', async () => {});
  it('連続タップ: 同ボタン 3 連打で重複 INSERT 防止', async () => {});
  it('時刻境界: 23:59:58 〜 00:00:02 を跨いだ session', async () => {});
  it('誕生日 0101: 1 月 1 日生まれがログイン可能', async () => {});
  it('社員番号 0008: 4 桁ゼロ詰めが正しく処理', async () => {});
});
```

### 3.3 権限テスト（8 階層 × 対象テーブル）

Garden 8-role 標準（toss / closer / cs / staff / outsource / manager / admin / super_admin）に基づく。
outsource は staff より広いが manager より狭い権限帯（自分担当のみアクセス、槙さん例外あり）。

```typescript
describe('Tree RLS 🔴', () => {
  const roles = ['toss', 'closer', 'cs', 'staff', 'outsource', 'manager', 'admin', 'super_admin'];

  roles.forEach(role => {
    describe(`role: ${role}`, () => {
      it('自セッションは SELECT 可', async () => {});
      it('他人セッションは SELECT 不可（manager 以下）', async () => {});
      it('自部署セッションは SELECT 可（manager）', async () => {});
      it('他部署セッションは SELECT 不可（manager）', async () => {});
      it('全社セッションは SELECT 可（admin+）', async () => {});
      it('自セッションに INSERT 可', async () => {});
      it('他人セッションに INSERT 不可', async () => {});
      it('当日分結果 UPDATE 可（本人）', async () => {});
      it('前日分結果 UPDATE 不可（本人、manager+ のみ）', async () => {});
      it('tree_call_records DELETE 直接拒否（全 role）', async () => {});
      it('マネージャー介入（指示送信）は manager+ のみ', async () => {});
      it('KPI エクスポートは manager+ のみ', async () => {});
    });
  });
});
```

### 3.4 データ境界テスト

| 境界 | テスト | 期待 |
|---|---|---|
| `duration_sec` NULL | Breeze 未計測時 | INSERT 成功、KPI 集計時 `0` 扱い |
| `duration_sec` 0 | 即断通話 | INSERT 成功 |
| `duration_sec` 負数 | 異常値 | CHECK 制約で拒否（`>= 0`）|
| `called_at` 未来時刻 | クライアント時計ズレ | サーバー側で `now()` で上書き |
| `result_code` 未定義値 | 新商材 | CHECK 制約で拒否 |
| `list_id` 存在しない | 削除済リスト参照 | FK 制約で拒否（論理削除は deleted_at チェック） |
| `total_calls` 上限 int4 | 21 億超過 | 年間 50 万 → 4 万年分、問題なし |

### 3.5 パフォーマンス計測

| シナリオ | 指標 | 目標 |
|---|---|---|
| Sprout 画面初回表示 | LCP | < 2.5s |
| 結果ボタン押下 → 次リスト | トランジション | < 500ms |
| マネージャーダッシュボード | 初回表示 | < 2s |
| KPI 画面 日次 30 日 | 初回表示 | < 2s |
| CSV エクスポート 1 万行 | 応答 | < 3s |
| 1 セッション 200 コール累積遅延 | 合算 | < 1s |

### 3.6 コンソールエラー監視

- DevTools Console にエラー 0 件（warning は許容）
- Playwright で `page.on('console')` 監視、`console.error` 検出時テスト失敗

### 3.7 アクセシビリティ

- axe-core で全画面 0 violations（color-contrast / aria-required 等）
- Lighthouse Accessibility スコア **95 以上**（Tree 🔴 ルール）
- キーボードのみで全画面完走可能（tab 順序検証）
- スクリーンリーダー（VoiceOver / NVDA）で結果ボタンが正しく読み上げられる

---

## 4. テストコード構成

### 4.1 ディレクトリ構成

```
src/app/tree/
├── _lib/
│   └── __tests__/
│       ├── offlineQueue.test.ts         (D-02 §5 キュー)
│       ├── resultCodes.test.ts           (callButtons と DB enum の一致)
│       ├── rollback.test.ts              (巻き戻し時間枠判定)
│       ├── shortcuts.test.ts             (ショートカット → 結果マッピング)
│       └── tossPayloadValidator.test.ts (D-04 zod)
├── calling/
│   ├── sprout/
│   │   └── __tests__/
│   │       └── page.test.tsx             (RTL + MSW)
│   └── branch/__tests__/page.test.tsx
└── kpi/__tests__/page.test.tsx

tests/e2e/tree/
├── login-and-session.spec.ts
├── sprout-flow.spec.ts
├── branch-flow.spec.ts
├── rollback.spec.ts
├── shortcuts.spec.ts
├── tossup-flow.spec.ts
├── manager-dashboard.spec.ts
├── kpi-dashboard.spec.ts
├── offline-queue.spec.ts
└── rls-enforcement.spec.ts
```

### 4.2 Vitest 設定（Tree 🔴 専用）

```typescript
// vitest.config.tree.ts
export default defineConfig({
  test: {
    include: ['src/app/tree/**/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
    // 🔴 Tree は mock DB を禁止（known-pitfalls §5.1）→ 実 DB 統合
    globals: true,
    setupFiles: ['./tests/setup-tree-db.ts'],
  },
});
```

### 4.3 Playwright 設定（Tree 🔴 専用プロジェクト）

```typescript
// playwright.config.ts（tree プロジェクト追加）
projects: [
  {
    name: 'tree',
    testDir: './tests/e2e/tree',
    use: {
      baseURL: process.env.TREE_TEST_BASE_URL || 'http://localhost:3000',
      // 物理キーボードショートカット検証が必要
      launchOptions: { headless: false, slowMo: 50 },
    },
    retries: 2,  // 🔴 Tree は 2 リトライ
  },
];
```

---

## 5. §17 Tree 特例（5 段階展開）の具体手順

### 5.1 段階別計画

| 段階 | 対象 | 期間 | 判定基準 | 担当 |
|---|---|---|---|---|
| α版 | 東海林さん 1 人 | 1 週間 | 7 種テスト完走 + 東海林さん OK | a-tree |
| β 1 人 | 信頼できるオペレーター 1 名 | 1 週間 | 新旧並行、コール数差 < 10% | マネージャー |
| β 2-3 人 | 追加 2 名（リーダー候補）| 1 週間 | バグ検出 0 件、UX フィードバック 5 件以下 | マネージャー |
| β 半数 | 部署の半数 | 1-2 週間 | KPI 指標が FM 時代 ± 5% 以内 | マネージャー + admin |
| リリース | 全員 + FM 停止 | — | 半数期間中に重大事故なし | admin |

### 5.2 各段階の受入チェック

#### α版

- [ ] §3 の 7 種テスト全項目パス
- [ ] 東海林さん 1 日稼働（実リスト 100 コール）
- [ ] オフライン切替テスト OK
- [ ] FM と同じ結果で INSERT される（抜き打ち 5 件比較）
- [ ] 巻き戻し誤タップ復旧 OK
- [ ] マネージャー UI で 東海林さんの動きが見える

#### β 1 人

- [ ] 1 週間の稼働ログ取得（事故 0 件）
- [ ] コール数 FM と Garden で ± 10% 以内（KPI 同等性）
- [ ] 使用者の UX フィードバック収集（Chatwork）
- [ ] 特に ショートカット混乱・オフライン失敗 を監視

#### β 2-3 人

- [ ] 同時稼働時の DB 負荷検証（tree_call_records INSERT 競合なし）
- [ ] 介入機能（指示送信）動作確認
- [ ] 同部署 3 名の KPI 比較検証（ダッシュボード表示確認）

#### β 半数

- [ ] 日次 10 万コール級の負荷検証
- [ ] 月次 KPI バッチ（MV REFRESH）正常稼働
- [ ] FM と Garden の統計一致（目標 ± 5%）
- [ ] 重大事故（データ損失・業務停止）0 件

#### リリース

- [ ] 全員投入、FM 読み取り専用に降格
- [ ] 切替後 30 日間は FM 並行参照可能
- [ ] 切替 +30 日で重大事故なければ FM アーカイブへ

---

## 6. FileMaker 並行運用中の切替判断基準

### 6.1 GO 判断

各段階で以下すべて ✅:

- [ ] テスト合格（前段階の 7 種テスト完走）
- [ ] KPI 指標が FM と ± 5%（半数以降は ± 3%）
- [ ] 重大事故 0 件
- [ ] オペレーター UX フィードバックでブロッカー 0
- [ ] マネージャー運用 OK（ダッシュボードが業務に耐える）

### 6.2 NO-GO 判断（即時 FM 切り戻し）

以下いずれか 1 つで NO-GO:

- [ ] データ損失（tree_call_records INSERT 欠損）
- [ ] コール数 KPI が FM と > 10% 乖離
- [ ] セッション open/close が 1 時間以上復旧不能
- [ ] マネージャー介入機能が半数以上で動作しない
- [ ] クレーム率が前月比 +2pp 以上 急上昇
- [ ] Chatwork 重大アラートが 24 時間内に 3 件以上

---

## 7. ロールバック計画（FM 即時切り戻し）

### 7.1 3 段階のロールバック

| 段階 | 対応 | 所要時間 |
|---|---|---|
| L1: 設定切替 | オペレーターに「本日は FM で」指示 | 5 分 |
| L2: Garden ログイン停止 | Tree 側ルーター手動切断 | 15 分 |
| L3: DB rollback | Tree テーブル drop + FM データ再同期 | 2 時間 |

### 7.2 切り戻し時のデータ扱い

- Garden で INSERT された結果は **FM に手動転記しない**
- Garden 側の `tree_call_records` は保持、アーカイブ扱い
- Soil 経由での集計は Garden 切断後も可能（BI 観点の連続性保持）

### 7.3 切り戻し訓練

- β 半数段階で月 1 回の L1 訓練（運用マニュアル確認）
- 事前通知なしの抜き打ち（リアリティ重視）
- 訓練結果を `docs/field-feedback-*.md` に記録

---

## 8. Vitest / RTL+MSW / Playwright の役割分担

### 8.1 Vitest（ユニット）

対象:

- `_lib/` の純関数
- `_constants/` の定数整合性
- zod スキーマ
- 計算ロジック（KPI 集計、稼働率計算）
- ショートカット → 結果コードマッピング

### 8.2 RTL + MSW（統合）

対象:

- Client Component × Supabase モック
- ウィザード Step 1/2 の状態遷移
- エラー Toast 表示
- オフラインキュー UI 表示

### 8.3 Playwright（E2E）

対象:

- ログイン完走
- 結果 INSERT → 次リスト 遷移
- 巻き戻し操作
- ショートカット F1-F10
- トスアップ 2 段階ウィザード
- マネージャーダッシュボード表示
- KPI 画面 期間切替
- エクスポート（ファイル保存検証）

### 8.4 実 DB 統合（🔴 Tree ルール）

- known-pitfalls §5.1 に従い、**RLS 挙動は実 DB（dev 環境）**で検証
- mock DB でユニット通過しても本番で落ちるリスクを排除

---

## 9. CI 設定（Tree 🔴 ルール）

### 9.1 ブロック条件

以下で PR マージブロック:

- Vitest カバレッジ < 85%
- RTL 統合テストいずれか失敗
- Playwright E2E 10 本中 1 つでも失敗
- axe-core violations > 0
- コンソールエラー検出（E2E 中）

### 9.2 実行スケジュール

| タイミング | テスト |
|---|---|
| PR push ごと | Vitest + RTL |
| PR label: `tree-e2e` 付与時 | Playwright（dev 環境）|
| develop マージ後 | 全テスト + 本番 staging smoke |
| 日次 02:00 | 全 E2E（dev 環境、回帰監視）|

---

## 10. 実装ステップ

1. **Step 1**: Vitest 設定分離（tree 用 config、0.5h）
2. **Step 2**: `_lib/__tests__/` 5 本作成（1.5h）
3. **Step 3**: Sprout/Branch ページ RTL 統合テスト（2.0h）
4. **Step 4**: E2E 10 本作成（Playwright、3.5h）
5. **Step 5**: axe-core 統合 + Lighthouse CI（0.5h）
6. **Step 6**: CI 設定更新（GitHub Actions、0.5h）
7. **Step 7**: 切り戻し訓練マニュアル起草（0.5h）
8. **Step 8**: 全テスト完走確認・ドキュメント化（1.0h）

**合計**: 約 **1.0d**（約 10h）

---

## 11. テスト優先順位（実装時）

### 11.1 必須（α版前に完走）

- Sprout/Branch 結果 INSERT E2E（§3.1）
- RLS 権限テスト（§3.3）
- オフラインキュー動作（§3.2）
- 巻き戻し境界（§3.2）

### 11.2 β版前に追加

- マネージャーダッシュボード polling（§3.1）
- KPI 画面表示（§3.1）
- Chatwork 通知（§cross-chatwork 経由）
- エクスポート機能

### 11.3 リリース前に追加

- 負荷試験（10 万コール/日）
- 24h 連続稼働試験
- 並行運用 KPI 比較（FM vs Garden 自動照合）

---

## 12. 判断保留事項

- **判1: 負荷試験ツール**
  - k6 / Artillery / JMeter どれを採用するか
  - **推定スタンス**: k6（Supabase 公式推奨、JS 書き）
- **判2: カバレッジ未達 PR の扱い**
  - 85% 下回る PR はマージ禁止 / 警告のみ
  - **推定スタンス**: 禁止（🔴 ルール厳守、Leaf 🟡 より厳しい）
- **判3: Playwright 物理キーボード検証**
  - F1-F10 ショートカットは実ブラウザ必須か、仮想キー OK か
  - **推定スタンス**: `headless: false` で実ブラウザ、CI 環境では xvfb 使用
- **判4: FM vs Garden 統計照合の自動化**
  - 日次バッチで両者数値突合、差分 > 5% でアラート
  - **推定スタンス**: 自動化実装、Python + FM ODBC + Supabase
- **判5: α版での録音聴取テスト**
  - D-03 §5 録音仕様未確定、α版テスト範囲外で良いか
  - **推定スタンス**: α版では除外、β段階で録音仕様確定後に追加
- **判6: 本番 rollback の実行権限**
  - DB drop の実行は誰が承認するか
  - **推定スタンス**: 東海林さん + admin 2 人承認（二重承認で誤発動防止）
- **判7: テスト用ダミー社員番号**
  - 0001-0099 をテスト用固定予約、実社員とぶつからない設計
  - **推定スタンス**: `0001-0009` を 9 名のテスト用に予約、他は実社員

---

## 13. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| Vitest 設定 + ユニット 5 本 | 2.0h |
| RTL 統合テスト（Sprout/Branch + 他） | 2.0h |
| Playwright E2E 10 本 | 3.5h |
| axe-core + Lighthouse CI | 0.5h |
| GitHub Actions CI 更新 | 0.5h |
| 切り戻しマニュアル起草 | 0.5h |
| 全テスト完走確認・ドキュメント | 1.0h |
| **合計** | **1.0d**（約 10h）|

---

## 14. まとめ: Tree Phase D 累計工数

| spec | 実装見込 |
|---|---|
| D-01 schema-migration | 0.9d |
| D-02 operator-ui | 1.0d |
| D-03 manager-ui | 0.8d |
| D-04 tossup-flow | 0.7d |
| D-05 kpi-dashboard | 0.7d |
| **D-06 test-strategy** | **1.0d** |
| **合計** | **約 5.1d** |

- Batch 9 起草時見込 4.5d → 実見積 5.1d（+0.6d）
- テスト戦略が 🔴 最厳格（Leaf 🟡 比 +0.25d）で増加
- 実装段階で §17 5 段階展開の期間（約 5-6 週間）を別途考慮

---

— spec-tree-phase-d-06 end —
