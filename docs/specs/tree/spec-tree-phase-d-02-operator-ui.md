# Tree Phase D-02: オペレーター UI（FileMaker 互換、コールセンター現場向け）

- 対象: コールセンターオペレーター（toss / closer）が毎日使う架電画面
- 優先度: **🔴 最高**（FileMaker 代替の中核、失敗許されない）
- 見積: **1.0d**
- 担当セッション: a-tree
- 作成: 2026-04-25（a-auto / Batch 9 Tree Phase D #02）
- 前提:
  - D-01（テーブル 3 つ、RLS、列制限 Trigger）
  - 既存 Tree 実装（`src/app/tree/{calling,call,breeze,aporan,confirm-wait}/page.tsx`）
  - spec-leaf-kanden-phase-c-03-input-ui-enhancement（2 段階ウィザード・1 クリック進行パターン）
  - spec-cross-error-handling（Batch 7、エラー表示と`role="alert"`統一）

---

## 1. 目的とスコープ

### 目的

**FileMaker で毎日稼働中のオペレーター業務フロー（リスト pull → 架電 → 結果入力 → 次リスト）を、Garden Tree 上で 100% 再現**する。ショートカット・1 クリック進行・オフライン耐性まで FM 時代と同等以上。

### 含める

- オペレーター 5 モード（Sprout / Branch / Breeze / Aporan / Confirm-wait）UI 要件
- FM 互換ショートカット（Leaf A-FMK1 パターン踏襲）
- 1 クリックステータス進行（Leaf A-2 パターン）
- リスト pull → 架電 → 結果入力 → 次リスト のフロー
- 通話中の画面遷移禁止ガード（`beforeunload` + in-app）
- オフライン耐性（localStorage キュー、再接続時 flush）
- エラー表示（共通 Toast + `role="alert"`）
- 巻き戻し UI（誤タップ 5 秒以内はワンクリックで取消）

### 含めない

- マネージャー向け機能（D-03）
- トスアップ連携詳細（D-04）
- KPI ダッシュボード（D-05）
- 録音再生（§判断保留、D-03 で検討）

---

## 2. 既存実装との関係

### 2.1 既存 Tree の画面資産（`src/app/tree/`）

Phase D-02 で **修正・拡張**する既存画面：

| 画面 | 既存状態 | D-02 での変更 |
|---|---|---|
| `/tree/call` | デモ値 | Supabase 連携（tree_call_records INSERT） |
| `/tree/calling/sprout` | ボタン UI 完成 | 割当 pull + 結果 INSERT + 巻き戻し |
| `/tree/calling/branch` | 同上 | 同上 |
| `/tree/breeze` | タイマー UI | 通話秒数計測 → duration_sec 格納 |
| `/tree/aporan` | デモ | アポ予定の Leaf 連携（トスアップ準備） |
| `/tree/confirm-wait` | デモ | 同意確認取得中の状態保持 |

### 2.2 FM での典型フロー再現

```
┌──────────────────────────────────────────┐
│ 1. オペレーター出社 → ログイン            │
│ 2. キャンペーン選択（関電 / 光 / クレカ） │
│ 3. セッション開始（session_id 発行）      │
│ 4. リスト自動 pull（1 件ずつ or 5 件バッチ）│
│ 5. 画面に顧客情報表示 → 架電              │
│ 6. 結果ボタン 1 クリック → INSERT          │
│ 7. 次リストへ自動遷移                      │
│ 8. 休憩 / 終業 → セッション close         │
└──────────────────────────────────────────┘
```

**FM との差分はゼロ**が目標。UI/UX の差異はユーザー教育負担に直結するため、**互換必達**。

---

## 3. 画面設計

### 3.1 ログイン / キャンペーン選択（`/tree/call`）

- 既存 login 画面（社員番号 + 誕生日 4 桁）は維持
- ログイン後、キャンペーン選択画面を表示：

```
┌─────────────────────────────────────────────┐
│ 本日のキャンペーン                           │
│                                             │
│ [関電業務委託]  担当: 250 件 / 残: 180       │
│ [光回線]        担当: 120 件 / 残: 95        │
│ [クレカ]        担当:  80 件 / 残: 60        │
│                                             │
│ → 選択と同時に session_id 発行、Sprout 画面へ│
└─────────────────────────────────────────────┘
```

- 担当件数は `tree_agent_assignments` where `released_at IS NULL` で取得
- 残件数は assignments から `tree_call_records` を LEFT JOIN して `result_code IS NULL` のカウント

### 3.2 Sprout 画面（`/tree/calling/sprout`）— アポインター架電

```
┌──────────────────────────────────────────────┐
│ [< 前のリスト]  残 180 件  [次のリスト >]      │
│                                              │
│ 顧客名: 山田 太郎                             │
│ 電話: 080-1234-5678                          │
│ 住所: 大阪府大阪市北区 ...                     │
│ 備考: 前回 不通（2026-03-15 14:20）            │
│                                              │
│ ┌──────────┬──────────┬──────────┐            │
│ │  トス    │   担不   │ 見込 A   │ ← top      │
│ ├──────────┼──────────┼──────────┤            │
│ │  見込B   │  見込C   │  （空）  │            │
│ └──────────┴──────────┴──────────┘            │
│ ┌─────┬──────┬──────┬──────┬──────┐           │
│ │不通 │NGお断│NGクレ│NG契約│NG他  │ ← bottom   │
│ └─────┴──────┴──────┴──────┴──────┘           │
│                                              │
│ [ 巻き戻し（5s）]   メモ: [        ]           │
└──────────────────────────────────────────────┘
```

#### UI 要件

- **1 クリックで `tree_call_records` INSERT + 次リストへ遷移**（Leaf A-2 パターン）
- 結果ボタンは `_constants/callButtons.ts` の 10 種（Sprout）を維持
- 「前のリスト」は**結果入力後 5 秒以内のみ**有効（prev_result_code に現在値を保存して巻き戻し可能）
- 「トス」押下時は D-04 トスアップフローへ遷移（Leaf 案件化）
- メモ入力は任意（INSERT 前に focus させない、手早さ優先）

### 3.3 Branch 画面（`/tree/calling/branch`）— クローザー架電

Sprout とほぼ同構成、結果ボタンが `_constants/callButtons.ts` の Branch 11 種（受注 / 担不 / コイン / 見込 A-C / 不通 / NG 系 4 種）。

### 3.4 Breeze モード（`/tree/breeze`）— 呼吸連続架電

- オペレーターが「呼吸」のように連続架電する集中モード
- タイマー 4 連装（Dual Timer + Call Timer、既存 `BreezeDualTimer` / `QuadTimer`）
- 通話開始→結果入力→次リスト の間に **秒単位カウント**
- `duration_sec` は Call Timer から自動取得（手動修正不可、後続レビュー可）

### 3.5 Aporan（アポ欄）画面（`/tree/aporan`）

- アポ獲得後の一時保留エリア
- トス済リスト一覧、Leaf トスアップ ready 状態を表示
- トス完了 / 却下 / 再アプローチ の 3 択（D-04 で詳細）

### 3.6 Confirm-wait（同意確認待ち）画面

- 同意確認（第三者コンプライアンス）取得中のリストを保持
- タイマー: 確認期限（既定 30 分）
- 期限超過時は自動で `result_code = 'ng_other'` に降格（Chatwork Alert 付き）
  - **降格時の memo に `タイムアウト（30分超過）` を自動記録**（運用識別用）
  - D-01 schema の `result_code` CHECK 制約は 12 種で `'ng_timeout'` を含まず、`'ng_other'` 集約方式を採択（main- No. 121 案 A 採択、2026-05-08）。
  - 集計時は `result_code = 'ng_other' AND memo LIKE 'タイムアウト%'` で抽出可能（KPI ダッシュボードで「タイムアウト」を独立カテゴリ表示する場合は VIEW で分岐）。
  - 自動 INSERT は Vercel Cron で別途実装（D-02/D-03 別タスク）。

---

## 4. FM 互換ショートカット（Leaf A-FMK1 パターン）

既存 FM 時代のオペレーターが手癖で押すキーを完全再現：

| キー | 動作 | 画面 |
|---|---|---|
| `F1` | トス（Sprout）/ 受注（Branch） | 架電画面 |
| `F2` | 担不 | 架電画面 |
| `F3` | 見込 A | 架電画面 |
| `F4` | 見込 B | 架電画面 |
| `F5` | 見込 C | 架電画面 |
| `F6` | 不通 | 架電画面 |
| `F7` | NG お断り | 架電画面 |
| `F8` | NG クレーム | 架電画面 |
| `F9` | NG 契約済 | 架電画面 |
| `F10` | NG その他 | 架電画面 |
| `Ctrl+Z` | 巻き戻し（5s 以内） | 架電画面 |
| `Ctrl+→` | 次リスト | 架電画面 |
| `Ctrl+←` | 前リスト（結果未入力時のみ） | 架電画面 |
| `Esc` | メモ入力キャンセル | 架電画面 |
| `Enter` | メモ確定 | 架電画面 |

### 実装ポイント

- `useEffect` + `window.addEventListener('keydown')`（cleanup 必須）
- 既存 Next.js hotkey ライブラリは使わない（バンドル軽量化）
- コンフリクト防止: focus が `input` / `textarea` の場合はショートカット無効
- ユーザー設定でショートカット ON/OFF トグル（`localStorage`）

---

## 5. オフライン耐性

### 5.1 前提

- コールセンター WiFi が時折断（1〜3 分）でも業務継続必須
- モバイル回線での出張営業（関電フィールド訪問）もサポート

### 5.2 設計

```
┌─────────────────────────────────────┐
│ オフライン検知（navigator.onLine）   │
│   ↓                                 │
│ localStorage に結果 INSERT をキュー  │
│   - key: `tree_offline_queue_v1`    │
│   - value: [{ id, payload, ts }]    │
│   ↓                                 │
│ ユーザーには「保存待機中 N 件」表示  │
│   ↓                                 │
│ オンライン復帰時、キュー順に POST    │
│   - 成功したらキューから削除         │
│   - 失敗は 3 回リトライ後、手動復旧   │
└─────────────────────────────────────┘
```

### 5.3 UI 表示

- 右上のネットワーク状態バッジ（緑 🟢 / 黄 🟡 キューあり / 赤 🔴 オフライン）
- キュー件数 > 0 の間は `tree_calling_sessions` close を拒否
- キュー上限: 500 件（超過時は警告モーダル、業務停止扱い）

### 5.4 競合解決

- 同一 `session_id` + `list_id` の重複送信は DB 側 unique（アプリ側は last-write-wins）
- オフライン中の session_id 発行は UUID v4 クライアント生成（REFERENCES 制約は relaxed check で許容）

---

## 6. 通話中の画面遷移禁止ガード

### 6.1 前提

- 誤ってブラウザ戻る・タブ閉じ・別モジュール遷移で通話データ喪失する事故を防ぐ

### 6.2 実装

```typescript
// _components/CallGuard.tsx
useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => {
    if (isCalling) {
      e.preventDefault();
      e.returnValue = "通話中です。ページを離れると結果が保存されません。";
    }
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [isCalling]);
```

### 6.3 SPA 内遷移（Next.js App Router）

- `router.events` は App Router で利用不可
- カスタム `<Link>` コンポーネントで `isCalling` 時 `preventDefault` + モーダル確認
- サイドバー（`SidebarNav`）も同様にガード

---

## 7. 巻き戻し UI（誤タップ救済）

### 7.1 要件

- 結果ボタン押下後 **5 秒以内**は「巻き戻し」ボタン or `Ctrl+Z` で取消可能
- 巻き戻すと `tree_call_records.prev_result_code` に当時の値を保存 + UPDATE
- 5 秒経過後は巻き戻し不可（画面から消える）

### 7.2 理由

FM 時代の「誤って F7 押した、F8 だった」ミスを救済。FM は UPDATE 可能だったため、Garden も同等 UX が必要。

### 7.3 実装

- `useRef` で直近 INSERT ID と `setTimeout(5000)` を保持
- 巻き戻し時: UPDATE `result_code`, SET `prev_result_code = old, rollback_reason = 'user_undo'`
- 監査ログ `tree.call.rollback` を発火（D-01 §5）

---

## 8. エラー表示（共通 Toast + `role="alert"`）

spec-cross-error-handling §4 準拠：

| ケース | UI | 音 |
|---|---|---|
| INSERT 成功 | 右下 Toast 1.5s（緑）| beep 短 |
| INSERT 失敗（ネットワーク） | 右下 Toast 無期限（黄）+ オフラインキュー化 | なし |
| INSERT 失敗（RLS 拒否） | モーダル（赤、`role="alert"`）+ 管理者通知 | beep 長 |
| 巻き戻し成功 | 右下 Toast 1s（青） | なし |
| セッション close | 画面中央モーダル + ログアウト誘導 | なし |

- sonner ライブラリ統一（Batch 7 §5 合意予定）
- `aria-live="polite"` / `role="alert"` 統一（known-pitfalls §3.2）

---

## 9. パフォーマンス要件

| 指標 | 目標 | 計測方法 |
|---|---|---|
| 結果ボタン押下 → 次リスト表示 | < 500ms | Playwright |
| ログイン → Sprout 画面表示 | < 2s | Lighthouse |
| 1 セッション 200 コール処理の累積遅延 | < 総計 1s | 合成ベンチ |
| オフライン→オンライン時 100 件 flush | < 10s | Playwright + MSW |

---

## 10. アクセシビリティ

### 10.1 キーボード操作

- 全ての結果ボタンにショートカット（§4）
- Tab 順序: 顧客情報（読み取り） → 結果ボタン（左上から右下）→ メモ → 巻き戻し

### 10.2 色コントラスト

- 結果ボタンの背景色（`_constants/colors.ts`）は WCAG AA（4.5:1）以上を保証
- 緑（トス・受注）: `#3b9b5c` / 赤（NG）: `#c23a3a` → 白文字で AA クリア

### 10.3 スクリーンリーダー

- 結果ボタンに `aria-label="結果: トス (F1)"` 付与
- 残件数変更時 `aria-live="polite"` で読み上げ

---

## 11. モバイル対応（スマホ出張営業向け）

### 11.1 画面レイアウト

- 横画面推奨（結果ボタン 11 個並ぶため）
- 縦画面時は結果ボタンを 2 列 × 6 行にリフロー
- `max-width: 100vw; padding-inline: 8px`（known-pitfalls §3.4）

### 11.2 タップターゲット

- 結果ボタン min 44×44px（WCAG AA）
- F1-F10 ショートカット不可（物理キーボードなし）→ 画面ボタンのみ

---

## 12. 実装ステップ

1. **Step 1**: ログイン後のキャンペーン選択画面新設（0.5h）
2. **Step 2**: セッション open / close API（Server Action、0.5h）
3. **Step 3**: Sprout 画面の Supabase 連携（tree_call_records INSERT、1h）
4. **Step 4**: Branch 画面の同等対応（0.5h）
5. **Step 5**: FM 互換ショートカット実装（1h）
6. **Step 6**: 巻き戻し UI（0.5h）
7. **Step 7**: オフライン耐性（localStorage キュー + flush ロジック、1.5h）
8. **Step 8**: 画面遷移ガード（0.5h）
9. **Step 9**: Breeze / Aporan / Confirm-wait 連携（1.5h）
10. **Step 10**: 結合テスト・バグ修正（1.5h）

**合計**: 約 **1.0d**（8h）

---

## 13. テスト観点

詳細は D-06 §3.1「機能網羅テスト」。本 spec での必須観点：

- ショートカット 10 種 × Sprout/Branch の結果 INSERT 全件
- 巻き戻し 5 秒以内 / 5 秒超過の境界
- オフライン→オンライン復帰時のキュー flush
- RLS: オペレーターが他人の session_id に INSERT できない
- エラー 4 種（成功 / ネット失敗 / RLS 拒否 / 巻き戻し成功）の UI 表示
- 連続 200 コールの累積遅延

---

## 14. 判断保留事項

- **判1: キャンペーン選択の自動化**
  - 朝ログイン時に自動で前日と同キャンペーンを開くか、必ず選択させるか
  - **推定スタンス**: 前日と同じなら自動、新商材リリース時のみ選択強制
- **判2: オフラインキュー上限**
  - 500 件 / 1,000 件 / 無制限
  - **推定スタンス**: 500 件（それ以上溜まったら業務続行不可として扱う）
- **判3: 巻き戻し時間枠**
  - 5 秒 / 10 秒 / 30 秒
  - **推定スタンス**: 5 秒固定（長すぎると統計に歪み）
- **判4: ショートカット F1-F10 の競合**
  - ブラウザ機能（F5 リロード、F11 全画面）との衝突
  - **推定スタンス**: `e.preventDefault()` で上書き、ユーザー教育で周知
- **判5: 音声フィードバック（beep）**
  - ON/OFF トグルの要否
  - **推定スタンス**: 既定 OFF、個別設定で ON 可（耳疲労軽減）
- **判6: 電話番号リンクの挙動**
  - `tel:` リンクをタップで CTI 起動するか、表示のみか
  - **推定スタンス**: モバイルは `tel:`、デスクトップは表示のみ（CTI 未連携のため）
- **判7: メモ文字数上限**
  - 現在未設定
  - **推定スタンス**: 500 文字上限、超過は truncate 警告

---

## 15. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| 既存画面 5 枚への Supabase 連携追加 | 3.5h |
| FM 互換ショートカット + 巻き戻し | 1.5h |
| オフライン耐性（キュー + flush） | 1.5h |
| 画面遷移ガード + エラー Toast 統一 | 1.0h |
| モバイル対応（レイアウト・タップターゲット）| 0.5h |
| 結合テスト・バグ修正 | 1.0h |
| **合計** | **1.0d**（約 9h）|

---

— spec-tree-phase-d-02 end —
