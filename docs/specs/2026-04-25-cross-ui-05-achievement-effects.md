# Cross UI-05: 達成演出（花火・シャボン玉・紙吹雪・流れ星）

- 対象: Garden シリーズ全モジュール（ヘッダー中央の演出エリア）
- 優先度: **🟡 中**（モチベーション UX、段階投入可）
- 見積: **0.5d**
- 担当セッション: a-main + 各モジュール（発火トリガー実装）
- 作成: 2026-04-25（a-auto 002 / Batch 10 Cross UI #05）
- 前提:
  - UI-01（Header `achievementSlot` スロット）
  - 各モジュールの KPI / 目標達成イベント（Tree トス数 / Bud 振込件数 等）

---

## 1. 目的とスコープ

### 目的

業務上の達成（目標コール数、目標案件数、月次目標等）をリアルタイムで祝い、業務のモチベーションを高める。**ヘッダー全アプリ横断で持続表示**、ユーザーが閉じるまで残る。

### 含める

- 発火トリガー設計（リアルタイム検知 + ログイン時未確認分フォロー）
- ヘッダー内持続表示エリア仕様
- 4 種のアニメーション素材（花火 / シャボン玉 / 紙吹雪 / 流れ星）
- 同時複数演出の順序制御
- 秒数制御の将来拡張インターフェース
- 達成履歴のストア（`root_employees` or 専用テーブル）

### 含めない

- 具体的 KPI 目標値（各モジュール spec）
- 達成条件の計算ロジック（各モジュール内）
- メール・Chatwork 通知（cross-chatwork で別途）

---

## 2. 発火トリガー

### 2.1 トリガーの 2 系統

| 系統 | 契機 | 挙動 |
|---|---|---|
| **リアルタイム検知** | 業務アクション（INSERT/UPDATE）完了直後 | 即座に演出発火 |
| **ログイン時未確認分フォロー** | ログイン直後 / 全モジュール初回アクセス | 未確認の達成を順次表示 |

### 2.2 リアルタイム検知

各モジュールが達成を検知したら、`achievements` テーブルに INSERT + Realtime 通知：

```ts
// 各モジュール内で呼び出し
await logAchievement({
  employee_id: 'emp0123',
  type: 'tree_daily_toss',
  effect: 'fireworks',
  message: '本日のトス目標 10 件達成！',
  metadata: { count: 10, campaign: 'kanden' },
});
```

### 2.3 ログイン時フォロー

ログイン後、ユーザーの `unread` な達成を取得して順次表示：

```sql
SELECT * FROM achievements
WHERE employee_id = :me
  AND acknowledged_at IS NULL
ORDER BY achieved_at ASC;
```

---

## 3. データモデル

### 3.1 `achievements` テーブル

```sql
CREATE TABLE achievements (
  achievement_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       text NOT NULL REFERENCES root_employees(employee_number),
  module            text NOT NULL CHECK (module IN ('tree', 'leaf', 'bud', 'bloom', 'forest', 'rill', 'soil', 'seed', 'root')),
  achievement_type  text NOT NULL,
  effect            text NOT NULL CHECK (effect IN ('fireworks', 'bubbles', 'confetti', 'shooting_star')),
  message           text NOT NULL,
  metadata          jsonb,
  achieved_at       timestamptz NOT NULL DEFAULT now(),
  acknowledged_at   timestamptz,    -- ユーザーが「閉じる」した時刻
  expires_at        timestamptz,    -- 30 日後削除等
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ach_employee_unread ON achievements (employee_id)
  WHERE acknowledged_at IS NULL;
CREATE INDEX idx_ach_employee_time ON achievements (employee_id, achieved_at DESC);
```

### 3.2 RLS

```sql
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- 本人は自分の達成を SELECT / UPDATE（acknowledged_at のみ）可
CREATE POLICY ach_self_select ON achievements FOR SELECT
  USING (employee_id = auth_employee_number());

CREATE POLICY ach_self_ack ON achievements FOR UPDATE
  USING (employee_id = auth_employee_number())
  WITH CHECK (employee_id = auth_employee_number());

-- INSERT は SECURITY DEFINER 関数経由（アプリケーションから）
CREATE POLICY ach_admin_all ON achievements FOR ALL
  USING (has_role_at_least('admin'));
```

### 3.3 Realtime 購読

- Supabase Realtime で `achievements` テーブルを employee_id フィルタ購読
- INSERT イベント受信 → 即座にヘッダー演出発火

```ts
supabase.channel('achievements')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'achievements',
    filter: `employee_id=eq.${myEmployeeId}`,
  }, (payload) => {
    triggerAchievement(payload.new);
  })
  .subscribe();
```

---

## 4. ヘッダー持続表示エリア

### 4.1 位置・サイズ

```
┌─────────────────────────────────────────────────────────┐
│ Garden │ Tree    │    [🎆 達成演出スロット ×]   │👤 山田 │
└─────────────────────────────────────────────────────────┘
```

> **中央スロットの寸法は UI-01 §3.2.1 が正本**
> 中央達成演出スロットの幅・高さ・Header 高 / 余白は UI-01 §3.2.1（Header レイアウト寸法）を参照。
> 本 spec は内部演出（アイコン / メッセージ / 閉じる x ボタン / アニメーション）のみ管轄する。

- Header 中央（UI-01 `achievementSlot` prop に注入）
- 装飾: 角丸 8px、半透明背景 `rgba(255,255,255,0.1)`

### 4.2 表示内容

```
┌─ [🎆] 本日のトス目標 10 件達成！ ────── [×] ┐
```

- アイコン（効果の種類を示す絵文字）
- メッセージテキスト（最大 40 文字、長い場合は truncate）
- 閉じる x ボタン

### 4.3 持続時間

- **デフォルト**: ユーザーが x をクリックするまで（`acknowledged_at` を UPDATE）
- **将来拡張**: 秒数指定オプション（§6 インターフェース）
  - 例: auto-dismiss 10 秒、デフォルト null（無限）

### 4.4 複数達成の表示

- キュー式: 1 件表示中は後続を待機
- 閉じる → 次の達成を表示
- バッジに「+N」で後続件数を可視化: `[🎆 本日のトス目標 10 件達成！ (+2) ×]`

---

## 5. 4 種のアニメーション

### 5.1 花火（Fireworks）

- **使い所**: 月次目標達成、年間表彰等の**超重要達成**
- **演出**: 画面全体に花火パーティクル 3 秒 + Header にエンブレム
- **実装**: Canvas API + requestAnimationFrame
- **音**: なし（Phase 2 で検討）

### 5.2 シャボン玉（Bubbles）

- **使い所**: 日次目標達成、小さな達成
- **演出**: 画面下から上に shimmering bubbles 5 秒 + Header にエンブレム
- **実装**: CSS animation + SVG
- **軽量**: 30 bubbles パーティクル、CPU 使用率 < 5%

### 5.3 紙吹雪（Confetti）

- **使い所**: 受注成立、振込完了等の**節目達成**
- **演出**: 画面上から色とりどりの紙片が降る 4 秒
- **実装**: canvas-confetti ライブラリ（npm）
- **設定**: particleCount 200, spread 90, origin {x: 0.5, y: 0}

### 5.4 流れ星（Shooting Star）

- **使い所**: レア達成、継続記録（7 日連続トス等）
- **演出**: 画面右上 → 左下に流れ星 2 秒
- **実装**: CSS animation（path transform）
- **色**: 白〜水色グラデーション + 残光

### 5.5 効果選定の原則

各モジュールが「どの達成に、どの効果」を割り当てる：

```ts
// src/app/tree/_lib/achievements.ts
export const TREE_ACHIEVEMENTS = {
  daily_toss_10: { effect: 'bubbles', message: '本日のトス目標 10 件達成！' },
  monthly_toss_300: { effect: 'fireworks', message: '月次 300 トス達成！' },
  streak_7days: { effect: 'shooting_star', message: '7 日連続トスで記録更新！' },
  order_deal: { effect: 'confetti', message: '受注成立おめでとう！' },
};
```

---

## 6. 同時複数演出の順序制御

### 6.1 キューイング戦略

```ts
// src/components/shared/AchievementQueue.ts
class AchievementQueue {
  private queue: Achievement[] = [];
  private currentEffect: Achievement | null = null;

  enqueue(ach: Achievement) {
    this.queue.push(ach);
    if (!this.currentEffect) this.showNext();
  }

  showNext() {
    const next = this.queue.shift();
    if (!next) {
      this.currentEffect = null;
      return;
    }
    this.currentEffect = next;
    this.render(next);
  }

  acknowledge() {
    if (this.currentEffect) {
      supabase.from('achievements').update({ acknowledged_at: new Date() })
        .eq('achievement_id', this.currentEffect.achievement_id);
    }
    this.showNext();
  }
}
```

### 6.2 優先度制御

- 緊急度の高い達成（花火）は別キューに分ける
- 重要演出中に軽演出は後回し
- 同時 5 件以上溜まった場合は**まとめ表示**:

```
[🎉 本日 12 件の達成が溜まっています！ すべて見る ×]
```

### 6.3 演出の重ね表示回避

- 演出中は次の演出を遅延（前の演出終了 + 500ms 後）
- 花火演出中に別の花火が来た場合: **次の花火は控える**（視覚負荷回避）

---

## 7. ユーザー設定

### 7.1 設定項目（Root マイページ内）

| 設定 | 選択肢 | 既定 |
|---|---|---|
| 達成演出を有効にする | ON / OFF | ON |
| 効果別 ON/OFF | 花火/シャボン玉/紙吹雪/流れ星 個別 | 全 ON |
| 自動閉じるまで | 無限 / 5s / 10s / 30s | 無限 |
| 音を鳴らす（Phase 2） | ON / OFF | OFF |
| 演出の強度 | 控えめ / 通常 / 派手 | 通常 |

### 7.2 `root_employees` 列追加

```sql
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS achievement_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS achievement_effects jsonb DEFAULT '{"fireworks":true,"bubbles":true,"confetti":true,"shooting_star":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS achievement_auto_dismiss_sec int,  -- NULL = 無限
  ADD COLUMN IF NOT EXISTS achievement_intensity text CHECK (achievement_intensity IN ('subtle', 'normal', 'vivid')) DEFAULT 'normal';
```

### 7.3 アクセシビリティ

- **prefers-reduced-motion**: OS 設定で `reduce` の場合、アニメーション簡素化
- 花火 / シャボン玉は**静止絵 + アイコン点滅のみ**に置換

---

## 8. 実装ステップ

1. **Step 1**: `achievements` テーブル migration + RLS（1h）
2. **Step 2**: `src/components/shared/AchievementQueue.ts` 実装（1h）
3. **Step 3**: `src/components/shared/AchievementDisplay.tsx`（Header スロット）（1h）
4. **Step 4**: 4 種アニメーション実装
   - 花火: Canvas + particle（1.5h）
   - シャボン玉: CSS + SVG（0.5h）
   - 紙吹雪: canvas-confetti（0.5h）
   - 流れ星: CSS animation（0.5h）
5. **Step 5**: Realtime 購読 + リアルタイム検知（0.5h）
6. **Step 6**: ログイン時未確認フォロー処理（0.5h）
7. **Step 7**: Root マイページ設定 UI（0.5h）
8. **Step 8**: 結合テスト・バグ修正（0.5h）

**合計**: 約 **0.5d**（約 7.5h）

---

## 9. 他 spec との接続点

| 関連 spec | 接続 |
|---|---|
| UI-01 layout-theme | Header `achievementSlot` に AchievementDisplay を注入 |
| Tree D-05 KPI | 日次・月次 KPI 達成時に logAchievement 呼び出し |
| Bud A-05 承認フロー | 振込承認完了時に紙吹雪 |
| Forest Phase A | 月次決算提出時に花火 |

---

## 10. パフォーマンス

### 10.1 目標

- Realtime 購読時の帯域: < 1 KB/event
- アニメーション CPU 使用率: < 15%（花火時、中位スペック PC）
- 画面 FPS: 60 維持（アニメーション中）
- メモリ: 演出 3 件キュー保持で +2MB 以内

### 10.2 ベストプラクティス

- Canvas: `requestAnimationFrame` で描画、離脱時は `cancelAnimationFrame`
- SVG アニメーション: will-change で GPU 加速
- 未使用時のリソース解放（画面離脱 unmount）

---

## 11. 秒数制御の将来拡張インターフェース

### 11.1 API

```ts
type AchievementEffect = {
  type: 'fireworks' | 'bubbles' | 'confetti' | 'shooting_star';
  message: string;
  autoDismissSec?: number;  // null = 無限（既定）
  priority?: 'normal' | 'high';
  soundKey?: string;  // Phase 2
};
```

### 11.2 Phase 1 での扱い

- `autoDismissSec` は DB 列 `achievement_auto_dismiss_sec` で保持、アプリ層は現状 null（無限）で固定実装
- Phase 2 で UI 設定から自動閉じ有効化可

---

## 12. テスト観点

- Realtime INSERT 受信時の即発火
- ログイン時の未確認フォロー（未確認 5 件 → 順次表示）
- 演出キュー（5 件溜まった時のまとめ表示）
- 閉じる動作 → `acknowledged_at` UPDATE
- prefers-reduced-motion ON 時の簡素化
- ユーザー設定（効果別 OFF）の反映
- RLS: 他人の達成を見られないこと
- 演出中の画面遷移（達成キューが残る）

---

## 13. 判断保留事項

- **判1: 花火演出の負荷**
  - 低スペック PC で 60fps 出るか検証必要
  - **推定スタンス**: Phase 1 で測定、必要なら SVG アニメに降格
- **判2: 音の実装時期**
  - Phase 1 で音無しか、最初から音付きか
  - **推定スタンス**: Phase 1 無し、Phase 2 で option 化
- **判3: 達成履歴の保持期間**
  - 30 日 / 90 日 / 無期限
  - **推定スタンス**: 90 日で自動削除（ストレージ節約）
- **判4: 「まとめ表示」の閾値**
  - 5 件 / 10 件 / 設定可
  - **推定スタンス**: 5 件既定、ユーザー設定可
- **判5: 月次表彰等の専用演出**
  - 花火 + 音 + 追加エフェクト
  - **推定スタンス**: Phase 2、まずは花火のみ
- **判6: admin による演出のブロードキャスト**
  - 全社イベント時に全員に花火送信
  - **推定スタンス**: Phase 2、Phase 1 は個人達成のみ
- **判7: 複数効果の同時発火**
  - 受注 + 月次達成が同時に起きた場合の優先
  - **推定スタンス**: 重要度高優先（花火 > 紙吹雪 > シャボン玉 > 流れ星）

---

## 14. アクセシビリティ

### 14.1 ARIA

- 達成発生時に `role="status" aria-live="polite"` で通知
- x ボタンに `aria-label="達成通知を閉じる"`

### 14.2 色覚対応

- 効果の色だけに依存せず、アイコン絵文字で種類を示す
- 🎆 花火、🫧 シャボン玉、🎉 紙吹雪、⭐ 流れ星

### 14.3 prefers-reduced-motion

- `@media (prefers-reduced-motion: reduce)` で全アニメーション無効化
- 静止絵 + テキストのみで達成通知

---

## 15. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| DB migration + RLS | 1.0h |
| AchievementQueue + Display | 2.0h |
| 4 種アニメーション実装 | 3.0h |
| Realtime 購読 + 未確認フォロー | 1.0h |
| Root マイページ設定 | 0.5h |
| 結合テスト | 0.5h |
| **合計** | **0.5d**（約 8h）|

---

— spec-cross-ui-05 end —
