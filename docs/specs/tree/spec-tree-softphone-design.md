# Tree Softphone 設計仕様（Garden 内ソフトフォン共通コンポーネント）

- 対象: Garden 全モジュール（Tree が主、将来 Bud / Bloom 等から呼出可）から利用する**社内ソフトフォン**コンポーネント
- 優先度: **🔴 高**（Tree Phase D-2 の前提、コールセンター業務効率の中核）
- 見積: **2.0d**（Phase D-2 で実装、PoC 込み）
- 担当セッション: a-tree（実装）/ 東海林（イノベラ API 仕様調達）
- 作成: 2026-04-26（a-tree、a-main 006 確定事項を受けて起草）
- 改訂: **2026-04-26 v1.1（4 次 follow-up）— 判断保留 #3 / #4 / #5 確定**
- 改訂: **2026-04-26 v1.2（5 次 follow-up）— D-1+D-2 セットリリース戦略採択（#16）+ 録音 API 採用注記（#18）**

---

## 0. リリース戦略（2026-04-26 a-main 確定 #16、新案 D 採択）

### 🔴 D-1 + D-2 セットリリース戦略

**採択方針**: 本 spec の Garden ソフトフォン実装は、**Tree Phase D-1（基本架電）と D-2（自動発信）をセットで完成させ、テスト稼働で品質確保してから全体展開**する戦略の核心部分。

**従来案の廃止**: D-1 リリース後 1 ヶ月待ってから D-2 追加リリースする案は廃止。

#### 開発・展開タイムライン

| 段階 | 内容 |
|---|---|
| 開発期間 | **D-1 完成後すぐ D-2 着手、両機能を一体で完成させる**（D-2 = 自動発信 = 本 spec のソフトフォン実装） |
| α 版（東海林 1 人）| §16 7 種テスト完走、**D-1 + D-2 両方含む UI / 操作性確認** |
| 1 人現場テスト | コールセンタースタッフ 1 名で 1 週間（**D-1 + D-2 両方使用**、新旧 FileMaker 並行） |
| 2-3 人テスト | 1 週間 |
| 半数テスト | 1-2 週間 |
| 全員投入 | FileMaker 切替（**D-1 + D-2 セットで完全移行**）|

#### 工数への影響

本 spec のソフトフォン実装（2.0d）は、**Tree Phase D 統合プラン v3 §3 D-02 operator-ui に統合**された形で実装される。プラン全体の見積は **6.5d → 8.5d**（+2.0d）に修正。

#### 関連 memory

- `project_tree_d2_release_strategy.md`（本戦略の根拠）
- `feedback_quality_over_speed_priority.md`（品質最優先方針）
- CLAUDE.md §16（リリース前バグ確認 7 種テスト）
- CLAUDE.md §17（Tree 特例の段階展開）

### #18 録音 API 採用注記（2026-04-26 a-main 確定）

⚠️ **イノベラ API の採用具合（応答性能・カバレッジ・SLA）次第で、将来 Garden 内録音実装方針へ変更可能性あり**。本 spec §5「イノベラ API 連携」は当面の方針であり、β段階以降の運用評価で再判断する。

---
- 前提:
  - イノベラ PBX（既存稼働、月 7,000 円）
  - イノベラ API 仕様書（**未受領、要請中**）
  - Tree Phase A 認証（`garden_role` 7 階層）
  - Tree Phase D-01 schema（`tree_call_records` の `recording_url` 列）
  - Root B-1 権限管理（`root_user_permission_overrides` 個別 override）
  - 既存 X-Lite ソフトフォン（参考、簡素化対象）

---

## 1. 目的とスコープ

### 1.1 目的

Tree オペレーターが PC 内で **発信・通話制御を完結**できる Garden 内蔵ソフトフォンを提供する。X-Lite を Garden の業務に最適化した形で再実装し、画面遷移なしで架電・結果入力までを 1 連のフローに統合する。

### 1.2 設計コンセプト

| 観点 | 方針 |
|---|---|
| **UI ベース** | **マネーフォワード問合せボタン風**（右下フローティング、開閉可、邪魔にならない） |
| **機能ベース** | **X-Lite 簡素化版**（業務に必要なものだけ厳選） |
| **配置** | Tree 全画面 + 将来 Bud / Bloom 等から呼出可な共通コンポーネント |
| **権限** | ロール別グレーアウト（manager+ のみ転送・モニタリング） |
| **録音** | **イノベラ側自動、ソフトフォンから操作なし** |
| **API** | イノベラ API（月 7,000 円）+ 手動取込 fallback |

### 1.3 含める

- ソフトフォン UI（フローティング + 展開モーダル）
- 発信制御（10 機能）
- 権限ベースのボタン活性化
- 通話状態の Tree 画面側表示（呼び鈴・通話中・保留中）
- イノベラ API クライアント（PBX 側操作の代行）

### 1.4 含めない

- 録音ファイルの Garden 内保管（D-01 §0 判 0-1 確定: イノベラ継続使用）
- VoIP プロトコル実装（イノベラ API 経由のため不要）
- Tree 以外モジュールの個別カスタマイズ（共通コンポーネントとして提供、各モジュールがフックポイントで連携）

---

## 2. 必須機能（10 種）

X-Lite から「業務必須」を厳選した 10 機能を実装する。

| # | 機能 | UI 配置 | 権限 |
|---|---|---|---|
| 1 | 発信（dial） | テンキー + 「📞」ボタン | 全員（toss / closer / cs / staff / manager+） |
| 2 | 切断（hangup） | 通話中表示の「✖」ボタン | 全員 |
| 3 | 保留（hold） | 通話中の「⏸」ボタン | 全員 |
| 4 | ミュート（mute） | 通話中の「🔇」ボタン | 全員 |
| 5 | 再発信（redial） | テンキー右の「↻」ボタン | 全員 |
| 6 | **転送（XFER）** | 通話中の「↪」ボタン | **manager+ のみ**（staff 以下グレーアウト） |
| 7 | **モニタリング** | 通話中の「👁」ボタン（他人の通話に listen-only で参加） | **manager+ のみ**（staff 以下グレーアウト） |
| 8 | クリア（clear） | テンキーの「C」ボタン | 全員 |
| 9 | テンキー（dialpad） | 0-9 + * + # の 12 ボタン | 全員 |
| 10 | メモ（memo） | 通話中サイドパネル | 全員 |
| (補) | 履歴（history） | 通話履歴タブ | 全員（自分の履歴のみ、RLS） |

### そぎ落とす機能（X-Lite からの除外）

| 除外機能 | 理由 |
|---|---|
| 1/2 ライン切替 | Garden では同時 1 通話のみ運用 |
| RECORD ボタン | イノベラ側で自動録音、ユーザー操作不要 |
| AA（Auto Answer） | 業務上不要（手動応答が原則） |
| AC（Auto Conference） | Garden では会議通話想定なし |
| DND（Do Not Disturb） | システムでオペレーターの状態管理（在席/離席）するため不要 |
| CONF（Conference） | 業務想定なし |
| FLASH | アナログ回線特有の機能、不要 |
| Volume スライダー | OS のボリュームで十分 |
| SPEAKER PHONE | 業務想定なし（ヘッドセット運用） |

---

## 3. UI 構造

### 3.1 通常状態（フローティングボタン）

画面右下に **マネーフォワード風の問合せボタン**型のフローティング UI を配置：

```
┌──────────────────────┐
│                      │
│   ... Garden 画面 ... │
│                      │
│                  ┌─┐ │
│                  │📞│ │  ← フローティングボタン
│                  └─┘ │
└──────────────────────┘
```

- サイズ: 56 × 56 px（Material Design FAB 準拠）
- 色: マネーフォワード風オレンジ系 or Tree テーマ緑
- 位置: 右下、`position: fixed; bottom: 24px; right: 24px;`
- ホバーでツールチップ「ソフトフォンを開く」
- クリックで展開モード（§3.2）へ切替

### 3.2 展開モード（モーダル風）

展開時は右下に縦長モーダル：

```
                   ┌──────────────────┐
                   │ 📞 ソフトフォン   │   ✕ │
                   ├──────────────────┤
                   │ ┌─┬─┬─┐          │
                   │ │1│2│3│          │
                   │ ├─┼─┼─┤  テンキー │
                   │ │4│5│6│          │
                   │ ├─┼─┼─┤          │
                   │ │7│8│9│          │
                   │ ├─┼─┼─┤          │
                   │ │*│0│#│          │
                   │ └─┴─┴─┘          │
                   │  C   ↻   📞      │ クリア・再発信・発信
                   │                  │
                   │ 入力: 080-...    │
                   │                  │
                   │ ── 通話履歴 ──   │
                   │ 09:35  田中様    │
                   │ 09:42  佐藤様    │
                   └──────────────────┘
```

- サイズ: 320 × 480 px（タッチターゲット 44px 以上確保）
- 閉じるボタン（✕）でフローティング状態に戻る
- ドラッグ移動可能（位置を localStorage で記憶）

### 3.3 通話中状態（画面拡張）

通話中は展開モードに通話制御ボタンが追加表示：

```
                   ┌──────────────────┐
                   │ 📞 ソフトフォン   │
                   ├──────────────────┤
                   │ 通話中: 田中様    │
                   │ 09:35:42 (00:42) │
                   │                  │
                   │  ┌─┐ ┌─┐ ┌─┐    │
                   │  │⏸│ │🔇│ │↪│   │ 保留・ミュート・転送
                   │  └─┘ └─┘ └─┘    │
                   │  ┌─┐ ┌─┐ ┌─┐    │
                   │  │👁│ │📝│ │✖│   │ モニタ・メモ・切断
                   │  └─┘ └─┘ └─┘    │
                   │                  │
                   │ メモ:            │
                   │ ┌──────────────┐ │
                   │ │              │ │
                   │ └──────────────┘ │
                   └──────────────────┘
```

- 転送（↪）・モニタリング（👁）は manager+ のみ active、staff 以下はグレーアウト + ツールチップ「manager+ で利用可」
- メモは `tree_call_records.memo` と双方向バインド（即時保存）

### 3.4 着信状態

```
                   ┌──────────────────┐
                   │ 🔔 着信中         │
                   │                  │
                   │   080-1234-5678  │
                   │                  │
                   │  ┌────┐  ┌────┐  │
                   │  │応答│  │拒否│  │
                   │  └────┘  └────┘  │
                   └──────────────────┘
```

- 着信音は OS 側で再生（イノベラ PBX 設定）
- 応答 → 通話中状態（§3.3）へ
- 拒否 → 通常状態（§3.1）へ

---

## 4. 権限ベースのグレーアウト

### 4.1 ロール × 機能マトリクス

| ロール | 発信 | 切断 | 保留 | ミュート | 再発信 | **転送** | **モニタリング** | クリア | テンキー | メモ |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| toss | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | ✅ | ✅ | ✅ |
| closer | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | ✅ | ✅ | ✅ |
| cs | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | ✅ | ✅ | ✅ |
| staff | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | ✅ | ✅ | ✅ |
| outsource | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 | ✅ | ✅ | ✅ |
| **manager** | ✅ | ✅ | ✅ | ✅ | ✅ | **✅** | **✅** | ✅ | ✅ | ✅ |
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ | **✅** | **✅** | ✅ | ✅ | ✅ |
| super_admin | ✅ | ✅ | ✅ | ✅ | ✅ | **✅** | **✅** | ✅ | ✅ | ✅ |

🔒 = グレーアウト（ボタンは見えるが押せない）+ ツールチップ「manager+ で利用可」

### 4.2 個別 override

`root_user_permission_overrides` テーブル（Root Phase B-1）で個別ユーザーに転送・モニタリングを許可可能：

```sql
-- 例: 社員番号 0123 の staff に転送機能を個別許可
INSERT INTO root_user_permission_overrides (employee_number, module, feature, allow)
VALUES ('0123', 'tree_softphone', 'xfer', true);
```

### 4.3 権限判定の実装

```typescript
// src/app/_components/Softphone/_lib/permissions.ts
export async function canUseFeature(
  feature: 'xfer' | 'monitoring' | 'dial' | ...,
  user: TreeUser
): Promise<boolean> {
  // 1. 個別 override をチェック
  const override = await getOverride(user.employee_number, 'tree_softphone', feature);
  if (override !== null) return override;

  // 2. ロール別デフォルトをチェック
  const ROLE_DEFAULTS: Record<string, string[]> = {
    xfer: ['manager', 'admin', 'super_admin'],
    monitoring: ['manager', 'admin', 'super_admin'],
    // 他の機能は全ロール OK
  };
  if (feature in ROLE_DEFAULTS) {
    return ROLE_DEFAULTS[feature].includes(user.garden_role);
  }
  return true;
}
```

---

## 5. イノベラ API 連携

### 5.1 連携方式

**Phase D-2 着手時にイノベラ API 仕様書受領**してから具体実装を確定。本 spec では枠組みのみ規定。

#### 想定 API エンドポイント（仕様書受領時に確定）

| 用途 | 想定 endpoint | メモ |
|---|---|---|
| 発信 | `POST /pbx/dial` | `{ from, to }` |
| 切断 | `POST /pbx/hangup` | `{ call_id }` |
| 保留 | `POST /pbx/hold` | `{ call_id, hold: true \| false }` |
| ミュート | `POST /pbx/mute` | `{ call_id, mute: true \| false }` |
| 転送 | `POST /pbx/xfer` | `{ call_id, target }` |
| モニタリング | `POST /pbx/monitor` | `{ session_id, listener }` |
| 着信通知 | WebSocket / Webhook | `{ call_id, from, to, status }` |
| 録音 URL 取得 | `GET /pbx/recordings/:call_id` | `{ recording_url }` |

#### 認証

API キー方式想定。`.env.local`:
```
INNOVERA_API_KEY=...
INNOVERA_API_BASE_URL=https://api.innovera.example.com/v1
```

API キーは Server Action 内のみで使用、クライアントに露出しない。

### 5.2 手動取込 fallback

イノベラ API が利用不可（仕様書遅延 / API ダウン等）の場合：
- 発信は **PBX デスクフォンを別端末で運用**（Garden は表示のみ、通話制御なし）
- 録音 URL は **管理者が手動で `tree_call_records.recording_url` に貼り付け**（CSV 一括取込フォームを Phase D-1.5 で実装）
- D-01 §0 判 0-1 の「手動取込 fallback」として既定運用

### 5.3 録音

- イノベラ側で**自動録音**（Garden 側からは制御不可）
- 通話終了後、API で録音 URL を取得 → `tree_call_records.recording_url` に格納
- Garden 内には**録音ファイル本体を保管しない**（D-01 §0 判 0-1 確定）
- 録音再生は D-03 §0 判 0-1 によりイノベラ PBX 画面リンク誘導（Phase D-1）/ Garden 内再生は D-2 検討

---

## 6. Tree 画面との連携

### 6.1 電話番号要素のフックポイント

D-02 §0 判 0-6 確定により、Phase D-2 で電話番号タップ → softphone.dial(phoneNumber) を実装：

```tsx
// src/app/tree/_components/TreePhoneNumber.tsx
import { useSoftphone } from '@/app/_components/Softphone/SoftphoneProvider';

export function TreePhoneNumber({ tel }: { tel: string }) {
  const softphone = useSoftphone();
  return (
    <button
      onClick={() => softphone.dial(tel)}
      className="text-blue-600 hover:underline"
    >
      📞 {tel}
    </button>
  );
}
```

D-02 spec で本コンポーネントを Phase D-1 から先行作成しておき、softphone Provider 完成後に dial() 呼出を有効化する。

### 6.2 通話結果と call_records の同期

通話終了時：
1. softphone から `tree_call_records` に行を作成（call_id / phone / duration_sec / recording_url）
2. 結果ボタン押下時に `result_code` を UPDATE（既存 D-02 フロー）
3. 整合性: 1 通話 = 1 call_record（softphone 開始時に行作成、結果ボタンで完了）

---

## 7. 共通コンポーネント設計

### 7.1 ファイル配置

```
src/app/_components/Softphone/        ← Garden 全体共通（Tree 配下ではない）
├── SoftphoneProvider.tsx             ← Context、全モジュールから useSoftphone() で参照
├── SoftphoneFloatingButton.tsx       ← フローティング UI（§3.1）
├── SoftphonePanel.tsx                ← 展開モード UI（§3.2 §3.3）
├── SoftphoneIncomingCall.tsx         ← 着信モーダル（§3.4）
├── _lib/
│   ├── innoveraClient.ts             ← イノベラ API クライアント
│   ├── permissions.ts                ← §4.3
│   └── types.ts
├── _hooks/
│   ├── useSoftphone.ts               ← 全モジュールから参照（dial / hangup / status）
│   └── useIncomingCall.ts
└── __tests__/
```

### 7.2 Provider 配置

ルート `layout.tsx` に Provider を配置、全モジュールから `useSoftphone()` で利用可能：

```tsx
// src/app/layout.tsx
import { SoftphoneProvider } from '@/app/_components/Softphone/SoftphoneProvider';

export default function RootLayout({ children }) {
  return (
    <SoftphoneProvider>
      {children}
    </SoftphoneProvider>
  );
}
```

### 7.3 他モジュールからの利用例（将来）

```tsx
// 例: Bud で顧客サポート電話をかける
import { useSoftphone } from '@/app/_components/Softphone/SoftphoneProvider';

function VendorContactCard({ vendor }) {
  const softphone = useSoftphone();
  return (
    <button onClick={() => softphone.dial(vendor.phone)}>
      取引先に電話する
    </button>
  );
}
```

---

## 8. 実装ステップと見積

| Phase | 作業 | 見積 |
|---|---|---|
| D-2 開始時 | イノベラ API 仕様書受領 + 仕様読込 | 0.5d（東海林さん側手配 + a-tree 読解） |
| D-2 PoC | `innoveraClient.ts` PoC（dial 1 機能のみ）| 0.5d |
| D-2 UI 1 | `SoftphoneFloatingButton` + `SoftphonePanel`（基本機能 5 種）| 0.5d |
| D-2 UI 2 | 通話中状態 + 権限グレーアウト + 履歴 | 0.5d |
| D-2 連携 | `tree_call_records` 同期 + Tree 画面のフックポイント | 0.25d |
| D-2 fallback | 手動取込 CSV フォーム（イノベラ API 障害時の運用継続） | 0.25d |
| **合計** | | **2.0d**（約 16h、PoC 含む） |

> 注: イノベラ API 仕様書の遅延がある場合、本 spec の Phase D-2 着手は**仕様書受領後**に開始。それまでは Tree D-02 §0 判 0-6 の Phase D-1 = 表示のみで運用継続。

---

## 9. テスト観点

D-06 §3 に準拠：
- Vitest: `permissions.ts` の判定（10 機能 × 8 ロール）
- RTL: フローティング → 展開 → 通話中の状態遷移
- Playwright E2E: 発信 → 通話 → 切断のフロー（イノベラ API は mock）
- 権限テスト: 7 ロール × 転送・モニタリングのアクセス制御
- 個別 override テスト: `root_user_permission_overrides` の動作確認

---

## 10. 判断保留事項（Phase D-2 着手前に確定）

> v1.1（2026-04-26 4 次 follow-up）で #3 / #4 / #5 を確定。

| # | 項目 | ステータス |
|---|---|---|
| 1 | イノベラ API 仕様書受領時期 | **保留**: 東海林さんがイノベラに API 仕様書要請中 |
| 2 | Webhook（着信通知）の認証 | **保留**: API 仕様書受領時に確定（HMAC 推奨） |
| 3 | モニタリング機能の被モニタ側通知 | **✅ 確定（v1.1）**: **デフォルト OFF** + `root_settings.softphone_monitor_notify_enabled` で運用切替可能。詳細は §10.3 |
| 4 | フローティングボタンの色 | **✅ 確定（v1.1）**: **後道さん FB 不要**（架電画面は後道さん非閲覧、東海林さん判断で確定）。詳細は §10.4 |
| 5 | フローティングの位置記憶 | **✅ 確定（v1.1）**: **`root_employees.softphone_position` jsonb（アカウントごと記憶）**。詳細は §10.5 |

### 10.3 #3 モニタリング機能の被モニタ側通知（確定詳細）

**確定方針**:
- デフォルト = **OFF**（被モニタ側に通知しない、サイレントモニタリング）
- `root_settings.softphone_monitor_notify_enabled` で運用中の切替が可能
  - `true`：被モニタ側にバナー / Toast「モニタリング中です」を表示
  - `false`（既定）：サイレント（被モニタ側に表示しない）
- 設定変更権限: **admin+ のみ**（`spec-tree-softphone-design` §4 と整合）
- 監査ログ: 設定変更時に `root_audit_log` へ記録

**設計判断の根拠**:
- マネージャー教育目的のモニタリングではサイレントが標準（業務妨害にならない）
- 一方、プライバシー保護や法令対応で通知が必要なケースもあるため、設定で切替可能
- `root_settings` 経由で運用変更可能（コード変更なし）

**関連 schema 拡張要件**（Root Phase B 範疇）:
```sql
INSERT INTO root_settings (key, value, description) VALUES
  ('softphone_monitor_notify_enabled', 'false', 'ソフトフォンのモニタリング時、被モニタ側に通知するか（admin で切替可）')
ON CONFLICT (key) DO NOTHING;
```

### 10.4 #4 フローティングボタンの色（確定詳細）

**確定方針**:
- **後道さん FB 不要**
- 東海林さん判断で確定 = **マネーフォワード風オレンジ系**を採用（実装時に最終的な hex 値を確定）

**設計判断の根拠（架電画面 = 後道さん非閲覧の原則）**:
- 後道さん（社長）は経営ダッシュボード（Garden Forest 等）のみ閲覧
- 架電画面（toss / closer 専用）は後道さん非対象 = 後道さん FB を取る必要がない
- memory `feedback_ui_first_then_postcheck_with_godo.md` の **例外**: 「架電画面（toss / closer 専用）は後道さん FB 不要」を本 spec § 10.4 で確定

**memory への反映予定**:
- `feedback_ui_first_then_postcheck_with_godo.md` の更新提案 = 「架電画面（toss/closer 専用、Tree D-02/D-03 の sprout/branch/breeze 等）は後道さん FB 不要」を例外として追記
- → a-main 経由で反映依頼（本 spec の範囲外）

### 10.5 #5 フローティングの位置記憶（確定詳細）

**確定方針**:
- **`root_employees.softphone_position` jsonb 列にアカウントごと記憶**
- 旧案（localStorage）は**廃止**（デバイス切替時に位置がリセットされる問題を回避）

**スキーマ拡張**（Root Phase A 互換、本 spec 由来の追加要件）:
```sql
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS softphone_position jsonb DEFAULT NULL;
-- 例: {"x": 1280, "y": 720, "expanded": false}
```

**実装方針**:
- 移動 / 開閉時に `softphone_position` を UPDATE（debounce 500ms）
- ログイン直後に `softphone_position` を SELECT、初期位置として復元
- `softphone_position IS NULL` なら既定位置（右下、`{x: window.innerWidth - 80, y: window.innerHeight - 80, expanded: false}`）を使用

**メリット**:
- ✅ デバイスを変えても自分の好きな位置が再現
- ✅ 位置を一度決めたら、PC 故障 / 入れ替え時にも引き継がれる
- ✅ admin が「全員の初期位置を統一する」運用も可能（個人の上書きが優先）

---

## 11. まとめ

- Phase D-2 で実装、**イノベラ API 仕様書受領後**に着手
- X-Lite 簡素化版 + マネーフォワード風 UI = Garden 業務に最適化
- 転送・モニタリングは manager+ のみ（個別 override 可）
- 録音は **イノベラ側自動**、Garden 内に保管しない（D-01 §0 判 0-1 確定）
- Tree 全画面 + 将来 Bud / Bloom 等から共通コンポーネントとして利用

---

## 改訂履歴

| 日付 | 版 | 改訂内容 | 担当 |
|---|---|---|---|
| 2026-04-26 | v1.0（初版） | 起草。a-main 006 確定事項（§2.1 ソフトフォン構築 8 項目）を仕様化。 | a-tree |
| 2026-04-26 | v1.1（4 次 follow-up）| **判断保留 #3 / #4 / #5 確定**: ①モニタリング被モニタ側通知 = デフォルト OFF + `root_settings.softphone_monitor_notify_enabled` で切替可能（§10.3）/ ②フローティングボタン色 = 後道さん FB 不要、東海林さん判断（マネーフォワード風オレンジ採用、§10.4、架電画面後道さん非閲覧原則の例外を明文化）/ ③位置記憶 = `root_employees.softphone_position` jsonb でアカウントごと記憶（§10.5、localStorage 案廃止）。 | a-tree |
| 2026-04-26 | v1.2（5 次 follow-up）| **D-1+D-2 セットリリース戦略採択（#16、§0 新設）**: 従来の「D-1 単独リリース → 1 ヶ月後に D-2 追加」案を廃止、両機能を一体で完成させてテスト稼働 → 全体展開で FM 完全切替。プラン v3 全体の見積を 6.5d → 8.5d（+2.0d ソフトフォン実装）に修正。+ **録音 API 採用注記（#18）**: イノベラ API 採用具合次第で Garden 内録音実装方針へ変更可能性あり、§0 末尾に明記。 | a-tree |

— spec-tree-softphone-design end —
