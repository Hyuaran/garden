# Tree Toast 通知設計仕様（共通コンポーネント）

- 対象: Tree 全画面 + 将来他モジュールから利用する**共通 Toast 通知**コンポーネント
- 優先度: **🔴 高**（Tree D-02 / D-04 / D-03 全 spec の即時フィードバックの基盤）
- 見積: **0.4d**（実装、Tree D-02 と同時進行可能）
- 担当セッション: a-tree
- 作成: 2026-04-26（a-tree、a-main 006 確定事項を受けて起草）
- 改訂: **2026-04-26 v1.1（4 次 follow-up）— 通知センター統合（独立 localStorage 廃止）**
- 前提:
  - Tree Phase A 認証
  - **既存 KPIHeader 通知センター**（`src/app/tree/_components/KPIHeader.tsx` + `TreeStateContext` の `notifCenter` / `markRead` / `markAllRead`）— **本 spec の通知履歴は本実装に統合**
  - sonner（既存パッケージ採用想定、未導入なら本 spec で初導入）
  - spec-cross-error-handling（Batch 7、`role="alert"` 統一）
  - memory `project_tree_toss_focus_principle.md`（toss UI のトス完了結果即時反映）

---

## 1. 目的とスコープ

### 1.1 目的

Tree のオペレーター・マネージャーに対して **業務中断のない即時フィードバック**を Toast 通知で提供する。特に toss 役の「自分の上げたトスの結果（成約 / 見込み / NG）」を即時可視化し、モチベーション維持と業務改善 FB に活用する。

### 1.2 設計コンセプト

| 観点 | 方針 |
|---|---|
| 配置 | **画面右上**（業務操作の邪魔にならない位置） |
| 表示時間 | **重要度別**（成約 = 10 秒 / 見込み = 7 秒 / NG = 5 秒） |
| 業務中断 | **しない**（作業継続、見たい時だけ視線送る） |
| 集約 | 連続通知時は「成約 3 件」等で集約表示 |
| 音 | **既定 OFF、個別設定で ON 可**（D-02 §0 判 0-5 と整合） |
| 適用範囲 | Tree 全画面 + 将来他モジュール（cs / closer / manager+ 等の通知共通基盤） |

### 1.3 含める

- Toast UI コンポーネント（4 種類: 成約 / 見込み / NG / 失注）
- 通知集約ロジック（同種 N 件まとめ）
- クリック時の遷移（詳細画面へ）
- 音通知の ON/OFF 設定
- **既存 KPIHeader 通知センター（`notifCenter` / 既読・未読管理）への統合**（v1.1 改訂）
  - Toast 表示と同時に `TreeStateContext.addNotif()` 経由で通知センターにも記録
  - 翌日リセット運用（既存 Tree Breeze（→ Rill v1）の当日限り保持と整合）

### 1.4 含めない

- Chatwork 通知（spec-cross-chatwork-notification）
- メール通知（Phase 外）
- ブラウザネイティブ Notification API（Phase D-2 で検討）
- **独立 localStorage での通知履歴保管**（v1.1 改訂で廃止、KPIHeader 通知センターに統合）

---

## 1.5 v1.1 改訂サマリ（2026-04-26 4 次 follow-up）

| 項目 | v1.0（旧） | v1.1（新） |
|---|---|---|
| 通知履歴保持 | localStorage で 30 件 | **既存 KPIHeader 通知センターと統合**、独立 localStorage 廃止 |
| 履歴の表示先 | 専用パネル（未実装）| **KPIHeader のベルアイコン → ドロップダウン**（既存実装） |
| 既読 / 未読管理 | （v1.0 に未定義）| **`TreeStateContext.markRead(id)` / `markAllRead()` を流用** |
| 履歴保管期間 | デバイス毎 | **当日分全件保管 + 翌日リセット**（Rill v1 と同期） |
| 「履歴」リンク動作 | （v1.0 に未定義）| **通知センター（KPIHeader ベル）を開く動作** |

**要点**: Toast = 即時表示（5-10 秒で消滅）、通知センター = 当日全件 + 既読/未読 + 履歴閲覧。両者は **役割分離**。

---

## 2. 通知種別と仕様

### 2.1 種別マトリクス

| 種別 | アイコン | 背景色 | 表示時間 | 用途 |
|---|:-:|:-:|:-:|---|
| **成約** | 🎉 | **金（gold, #FFD700）** | **10 秒** | 自分のトスが成約になった、自分の closer 担当案件が成約 |
| **見込み** | ✨ | **緑（#22C55E）** | **7 秒** | 自分のトスが見込み案件になった |
| **NG** | ❌ | **赤（#EF4444）** | **5 秒** | 自分のトスが NG / closer から「不通」フィードバック |
| **失注** | 🚫 | **グレー（#6B7280）** | **5 秒** | 案件が失注（クレーム / キャンセル等） |
| (補) **情報** | ℹ️ | **青（#3B82F6）** | **3 秒** | システム通知（接続復帰 / オフラインキュー flush 完了 等） |
| (補) **警告** | ⚠️ | **オレンジ（#F59E0B）** | **5 秒** | オフラインキュー上限警告 / メモ truncate 等 |
| (補) **エラー** | 🚨 | **赤濃（#DC2626）** | **持続（手動閉じ）** | API エラー / 認証切れ等 |

### 2.2 表示時間の根拠

- 成約 10 秒: 嬉しい知らせは長めに見せる（モチベーション）
- 見込み 7 秒: ほどほどの長さで業務継続
- NG 5 秒: 短く見せて気持ちを切り替えさせる
- エラーは持続: 重大なため見落とし防止

### 2.3 配置詳細

```
┌────────────────────────────────────────────┐
│                                ┌─────────┐ │
│                                │🎉 成約  │ │  ← 右上から下へスタック
│                                │田中様   │ │
│                                └─────────┘ │
│                                ┌─────────┐ │
│                                │✨ 見込み│ │
│                                │佐藤様   │ │
│                                └─────────┘ │
│                                            │
│   ... Garden 画面 ...                       │
│                                            │
└────────────────────────────────────────────┘
```

- 位置: `position: fixed; top: 16px; right: 16px;`
- 横幅: 320 px（モバイルは 90vw）
- スタック: 最大 5 件、超過時は古いものから自動消滅
- スライドイン: 右からスライド（200ms）
- スライドアウト: 右へスライド + フェード（200ms）

### 2.4 集約表示

短時間（5 秒以内）に同種が連続発生したら集約：

```
┌─────────────────┐
│🎉 成約 3 件     │  ← 集約
│田中様 ほか 2 件 │
└─────────────────┘
```

- 集約条件: 同種 + 5 秒以内に 2 件以上
- 集約後の表示時間は最も長いもの（成約なら 10 秒）
- クリックで `/tree/toss-wait` 該当行一覧へ遷移

---

## 3. クリック動作

### 3.1 詳細画面遷移

| 種別 | クリック遷移先 |
|---|---|
| 成約 / 見込み / NG / 失注 | `/tree/toss-wait?call_id={call_id}` （該当行ハイライト） |
| 情報 | 該当しない（クリック動作なし） |
| 警告 | 該当する設定画面へ遷移（例: オフラインキューなら `/tree/mypage`） |
| エラー | エラー詳細モーダル（手動閉じ） |

### 3.2 遷移先実装方針

`/tree/toss-wait` は既存実装あり、本 spec で「`call_id` パラメータで該当行をハイライト + scroll into view」を追加要求。

---

## 4. 音通知

### 4.1 設定

D-02 §0 判 0-5「音声フィードバック（beep）」と整合：
- 既定 OFF
- 個別設定で ON 可（`/tree/mypage` の通知設定タブ）
- 設定保存先: `root_employees.notification_preferences` jsonb（D-03 §0 判 0-6 のアラート設定と統合）

### 4.2 音種

- 成約: 短い祝福音（`success.mp3`）
- 見込み: 中性のチャイム（`info.mp3`）
- NG / 失注 / 警告 / エラー: 軽い警告音（`warning.mp3`）
- 情報: 無音（音 OFF が既定）

### 4.3 音ファイル配置

```
public/sounds/
├── success.mp3   ← 1.5 秒、控えめ
├── info.mp3      ← 1.0 秒
└── warning.mp3   ← 0.8 秒、強調しすぎない
```

ライセンス: CC0 / public domain の音源を選定（東海林さん承認後に決定）。

---

## 5. 業務中断しない設計

### 5.1 原則

- Toast は **focus を奪わない**（input にフォーカスがあれば維持）
- スクロール位置を変えない
- モーダルブロックしない（背景クリック可、ESC 不要）
- アニメーションは控えめ（200ms 以内、視覚的負荷を最小化）

### 5.2 アクセシビリティ

- `role="status"` （成約 / 見込み / 情報）
- `role="alert"` （NG / 失注 / 警告 / エラー）
- `aria-live="polite"` （成約 / 見込み / 情報）
- `aria-live="assertive"` （NG / 失注 / 警告 / エラー）
- VoiceOver / NVDA で読み上げ可能（spec-cross-error-handling §4 準拠）

---

## 6. API 設計

### 6.1 useToast Hook（v1.1: 通知センター統合）

```typescript
// src/app/_components/Toast/useToast.ts
import { useToast as _useToast } from '@/app/_components/Toast/ToastProvider';
import { useTreeState } from '@/app/tree/_state/TreeStateContext';

export type ToastType = 'success' | 'prospect' | 'ng' | 'lost' | 'info' | 'warning' | 'error';
export type ToastOptions = {
  type: ToastType;
  title: string;
  message?: string;
  callId?: string;        // クリック時遷移用
  duration?: number;      // ms、省略時は type 別既定
  sound?: boolean;        // ON 強制（既定はユーザー設定）
  silent?: boolean;       // true なら通知センターに記録のみ、Toast 表示しない（v1.1 追加）
};

export function useToast() {
  const ctx = _useToast();
  const { addNotif } = useTreeState(); // KPIHeader 通知センターへの追加 hook

  function emit(opts: ToastOptions) {
    if (!opts.silent) ctx.show(opts);
    // v1.1: Toast 表示と同時に通知センターにも記録（既存 KPIHeader 統合）
    addNotif({
      type: opts.type,
      title: opts.title,
      message: opts.message,
      callId: opts.callId,
      timestamp: Date.now(),
      read: false,
    });
  }

  return {
    success: (msg: string, options?: Partial<ToastOptions>) => emit({ type: 'success', title: '🎉 成約', message: msg, ...options }),
    prospect: (msg: string, options?: Partial<ToastOptions>) => emit({ type: 'prospect', title: '✨ 見込み', message: msg, ...options }),
    ng: (msg: string, options?: Partial<ToastOptions>) => emit({ type: 'ng', title: '❌ NG', message: msg, ...options }),
    lost: (msg: string, options?: Partial<ToastOptions>) => emit({ type: 'lost', title: '🚫 失注', message: msg, ...options }),
    info: (msg: string, options?: Partial<ToastOptions>) => emit({ type: 'info', title: 'ℹ️ お知らせ', message: msg, ...options }),
    warning: (msg: string, options?: Partial<ToastOptions>) => emit({ type: 'warning', title: '⚠️ 注意', message: msg, ...options }),
    error: (msg: string, options?: Partial<ToastOptions>) => emit({ type: 'error', title: '🚨 エラー', message: msg, duration: -1, ...options }), // -1 = 持続
  };
}
```

> **v1.1 設計判断**: Toast 表示 = 即時可視化（5-10 秒）、通知センター = 当日履歴 + 既読/未読管理。両者を `useToast()` の単一呼出で同時更新する。`silent: true` で通知センターのみ記録（バックグラウンド通知用）。

### 6.2 利用例

```tsx
// src/app/tree/calling/sprout/page.tsx
import { useToast } from '@/app/_components/Toast/useToast';

function SproutPage() {
  const toast = useToast();

  const handleTossSuccess = (record: TreeCallRecord) => {
    toast.success(`${record.customer_name} 様（${record.list_name}）`, {
      callId: record.call_id,
    });
  };

  // closer から「成約」フィードバック受信時
  const handleClosingResult = (result: 'success' | 'ng') => {
    if (result === 'success') {
      toast.success('クローザーが成約に決めました！');
    } else {
      toast.ng('クローザーが NG 判定しました');
    }
  };
}
```

---

## 7. 共通コンポーネント設計

### 7.1 ファイル配置

```
src/app/_components/Toast/         ← Garden 全体共通
├── ToastProvider.tsx              ← Context、全モジュールから useToast() で参照
├── ToastContainer.tsx             ← 右上スタック表示（§2.3）
├── ToastItem.tsx                  ← 1 件の Toast UI
├── _lib/
│   ├── aggregator.ts              ← 集約ロジック（§2.4）
│   ├── sound.ts                   ← 音通知（§4）
│   └── types.ts
├── _hooks/
│   ├── useToast.ts                ← §6.1
│   └── useNotificationPreferences.ts
└── __tests__/
```

### 7.2 Provider 配置

ルート `layout.tsx` に Provider を配置（softphone と並列）：

```tsx
// src/app/layout.tsx
import { SoftphoneProvider } from '@/app/_components/Softphone/SoftphoneProvider';
import { ToastProvider } from '@/app/_components/Toast/ToastProvider';

export default function RootLayout({ children }) {
  return (
    <ToastProvider>
      <SoftphoneProvider>
        {children}
      </SoftphoneProvider>
    </ToastProvider>
  );
}
```

### 7.3 sonner との関係

既存の sonner ライブラリ（Tree D-02 §5 で導入予定）を**ベース**として採用。本 spec の API は sonner を wrap した Tree 業務向けカスタム API。

```typescript
// src/app/_components/Toast/ToastProvider.tsx
import { Toaster, toast as sonnerToast } from 'sonner';

export function ToastProvider({ children }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        // Tree カスタムスタイル
      />
    </>
  );
}

// 内部で sonner を使うが、ユーザーには useToast() 経由で公開
```

---

## 8. テスト観点

D-06 §3 に準拠：

| # | 観点 | テスト |
|---|---|---|
| 1 | 7 種別の表示時間（成約 10s / 見込み 7s / NG 5s 等） | Vitest（タイマー mock）|
| 2 | 集約ロジック（同種 5 秒以内 2 件以上） | Vitest |
| 3 | クリック時の `/tree/toss-wait?call_id=...` 遷移 | RTL |
| 4 | 音 ON/OFF 設定の反映 | Vitest |
| 5 | role / aria-live の正しい付与 | RTL + axe-core |
| 6 | スタック上限 5 件、超過時は古い順に消滅 | RTL |
| 7 | スライドイン / スライドアウトのアニメーション | Playwright（headless: false）|

---

## 9. 既存実装との整合

### 9.1 現状の Tree 画面

- 既存実装には統一 Toast はなし（個別画面で `alert()` や inline メッセージ）
- 本 spec で **全画面の通知を Toast に統一**

### 9.2 spec-cross-error-handling との整合

Batch 7 の cross-cutting spec で `role="alert"` 統一が要求されている。本 spec は同 spec に**完全準拠**：
- エラー / 警告系 = `role="alert"` + `aria-live="assertive"`
- 成功 / 情報系 = `role="status"` + `aria-live="polite"`

### 9.3 KPIHeader 通知センターとの統合（v1.1 追加）

**既存実装** `src/app/tree/_components/KPIHeader.tsx`：
- ベルアイコン + ドロップダウンパネル
- `notifCenter: NotifItem[]`（`TreeStateContext` 経由）
- 「未読 N 件」「既読 N 件」表示
- 「既読」（個別）「すべて既読」（一括）ボタン
- 外部クリックで閉じる

**本 spec の統合方針**：
- Toast 表示 = `sonner` で即時可視化（5-10 秒で消滅）
- 通知履歴 = `TreeStateContext.notifCenter` に記録（既読/未読管理 + ベル UI 経由で閲覧）
- `useToast()` の各メソッド呼出時、内部で `addNotif()`（新規追加 hook）も同時呼出
- 「履歴」リンク = ベルアイコンクリックで通知センターパネルを開く（既存 `setNotifCenterOpen(true)` 流用）
- **独立の localStorage 通知履歴は実装しない**（v1.0 → v1.1 の変更点）

#### TreeStateContext 拡張要件（本 spec 由来）

既存 `TreeStateContext` に以下を追加：
```typescript
type TreeStateContextType = {
  // ...既存
  notifCenter: NotifItem[];              // 既存
  notifCenterOpen: boolean;              // 既存
  setNotifCenterOpen: (b: boolean) => void; // 既存
  markRead: (id: string) => void;        // 既存
  markAllRead: () => void;               // 既存
  addNotif: (notif: Omit<NotifItem, 'id'>) => void; // 新規（v1.1）
  resetNotifsAtMidnight: () => void;     // 新規（v1.1、当日リセット用）
};
```

#### 翌日リセット運用

- 既存 Tree Breeze（→ Rill v1）の「当日限り保持」と整合
- `resetNotifsAtMidnight()` を 24:00 JST に発火（Server Action / Cron / クライアント側 setInterval のいずれか、実装時に判断）
- リセット時は `notifCenter = []` に戻す

---

## 10. 実装ステップと見積

| 作業 | 見込 |
|---|---|
| sonner 導入（未導入なら）+ 基本 ToastProvider | 0.5h |
| 7 種別の Toast Item コンポーネント + 色 / アイコン / 表示時間 | 1.0h |
| 集約ロジック + スタック表示 | 1.0h |
| クリック遷移 + `/tree/toss-wait` 連携 | 0.5h |
| 音通知（ON/OFF + 3 ファイル）| 0.5h |
| KPIHeader 通知センター統合（addNotif/resetNotifsAtMidnight 追加）| 0.25h |
| Vitest + RTL + a11y テスト | 0.75h |
| **合計** | **0.4d**（約 4.5h）|

---

## 11. 判断保留事項

| # | 項目 | 仮スタンス |
|---|---|---|
| 1 | 音ファイルの選定 | CC0 / public domain で 3 ファイル選定、東海林さん承認後決定 |
| 2 | ~~通知履歴の保持件数~~ → **v1.1 で解決**: 既存 KPIHeader 通知センター統合、当日全件保持 + 翌日リセット |
| 3 | モバイルでの表示位置 | 右上維持 vs 上部全幅 — UI 完成後に後道さん FB |
| 4 | エラー Toast の自動閉じ | 既定持続 vs 30 秒で消滅 — 持続を推奨（誤閉じ防止）|
| 5 | 集約タイマー | 5 秒固定 vs 設定可 — 5 秒固定で開始、運用 FB で調整 |

---

## 12. まとめ

- 画面右上、種別別表示時間（成約 10s / 見込み 7s / NG 5s 等）
- 業務中断しない設計（focus 奪わない、モーダルブロックなし）
- 集約表示で連続通知時のノイズ削減
- 音は既定 OFF、個別設定で ON 可（D-02 §0 判 0-5 整合）
- Tree 全画面 + 将来他モジュール共通コンポーネント
- 既存実装の `alert()` / inline メッセージを段階的に Toast へ移行

---

## 改訂履歴

| 日付 | 版 | 改訂内容 | 担当 |
|---|---|---|---|
| 2026-04-26 | v1.0（初版） | 起草。a-main 006 確定事項（§2.2 Toast 通知 9 項目）を仕様化。 | a-tree |
| 2026-04-26 | v1.1（4 次 follow-up）| **既存 KPIHeader 通知センター統合**：独立 localStorage 廃止、`TreeStateContext.notifCenter` に履歴記録、当日全件保持 + 翌日リセット運用、`addNotif` / `resetNotifsAtMidnight` を新規追加。「履歴」リンク = ベルアイコン押下で通知センターパネルを開く動作。`§1.5 v1.1 改訂サマリ` / `§6.1 useToast Hook（v1.1）` / `§9.3 KPIHeader 通知センター統合` を新設・更新。 | a-tree |

— spec-tree-toast-notification end —
