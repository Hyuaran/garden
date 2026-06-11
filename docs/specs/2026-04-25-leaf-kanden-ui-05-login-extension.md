# Leaf 関電 UI #05: ログイン拡張（位置情報・ロードマップポップアップ）

- 対象: Leaf 関電のログインフロー拡張
- 優先度: **🟡 高**（業務開始ルーチンの自動化）
- 見積: **1.0d 実装** / 0.2d spec
- 担当セッション: a-leaf
- 作成: 2026-04-25（a-auto 002 / Batch 13 Leaf 関電 UI #05）
- 前提:
  - Root 認証（Supabase Auth + root_employees）
  - spec-cross-chatwork（Batch 7、グループラインへの送信パターン）
  - spec-cross-ui-06（access-routing、ホーム遷移）

---

## 1. 目的とスコープ

### 目的

ログイン時に **位置情報の自動取得 + 稼働場所申告**を組み込み、現状チャットワークで手動送信している「現在位置」報告を Garden で自動化。同時に、Tree 風の**ログイン後ポップアップ**（ロードマップ + 案件件数）で業務開始時の情報集約を実現する。

### 含める

- ログイン時の位置情報取得（GPS、許可確認込み）
- 稼働場所入力（1 日 1 回、初回ログイン時）
- グループラインへの自動送信（Chatwork）
- ログイン後ポップアップ（ロードマップ表示）
- 「今日は表示しない」レ点で当日非表示（localStorage）
- ログイン履歴と稼働場所の管理

### 含めない

- Chatwork API 連携基盤（spec-cross-chatwork で対応済）
- ホーム遷移演出（spec-cross-ui-06）

---

## 2. ログイン時の位置情報取得

### 2.1 取得タイミング

```
ユーザーがログイン
  ↓
Supabase Auth 成功
  ↓
位置情報取得モーダル表示
  ↓
[許可] → ブラウザ Geolocation API
[拒否] → 手動位置入力モーダル
[後で] → スキップ（次回ログイン時に再表示）
  ↓
Garden DB に保存
  ↓
Chatwork グループラインに自動投稿
  ↓
ホーム画面へ
```

### 2.2 Geolocation API 利用

```ts
// src/app/leaf/kanden/_lib/geolocation.ts
export async function getCurrentLocation(): Promise<Location | null> {
  if (!('geolocation' in navigator)) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      }),
      (err) => {
        console.warn('Geolocation error:', err);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,  // 1 分以内のキャッシュ可
      }
    );
  });
}
```

### 2.3 ブラウザ権限

- 初回: `permissions.query({ name: 'geolocation' })` で確認
- 拒否済み: 手動入力モードに切替
- 一時的な拒否: 次回再試行

### 2.4 リバースジオコーディング

```ts
// 緯度経度から住所取得（OpenStreetMap Nominatim API）
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja`,
    { headers: { 'User-Agent': 'Garden-Leaf/1.0' } }
  );
  const data = await res.json();
  return data.display_name ?? null;
}
```

- 1 リクエスト/秒の利用制限（Nominatim 規約）
- 商用利用は別途 API 検討（Mapbox / Google）

---

## 3. 稼働場所入力（1 日 1 回）

### 3.1 タイミング

- 初回ログイン時のみ表示（同日 2 回目以降はスキップ）
- 翌日 0 時を境に再表示

### 3.2 入力 UI

```
┌─────────────────────────────────────────┐
│ 本日の稼働開始                           │
│                                         │
│ 📍 検出位置: 大阪府茨木市紫明園          │
│ 精度: ±25m                              │
│ [位置情報を再取得]                       │
│                                         │
│ 今日の稼働場所:                         │
│ ○ 大阪本社                               │
│ ○ 滋賀支店                               │
│ ○ 在宅                                   │
│ ● 営業先（外出）                         │
│   訪問先: [山田商事様]                    │
│                                         │
│ 自由メモ:                                │
│ [                                  ]    │
│                                         │
│ ☐ 位置情報をグループラインに自動送信      │
│                                         │
│ [スキップ]                  [稼働開始 →] │
└─────────────────────────────────────────┘
```

### 3.3 データモデル

```sql
CREATE TABLE leaf_kanden_login_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       text NOT NULL REFERENCES root_employees(employee_number),

  -- 位置情報
  latitude          numeric(10,7),
  longitude         numeric(10,7),
  accuracy_m        numeric(8,2),
  resolved_address  text,
  geolocation_at    timestamptz,

  -- 稼働場所
  work_location_type  text CHECK (work_location_type IN (
    'osaka_hq', 'shiga_branch', 'remote', 'visit', 'other'
  )),
  visit_destination text,
  free_note         text,

  -- Chatwork 送信
  chatwork_sent     boolean NOT NULL DEFAULT false,
  chatwork_sent_at  timestamptz,
  chatwork_message_id text,

  -- ログイン情報
  login_at          timestamptz NOT NULL DEFAULT now(),
  user_agent        text,
  ip_address        text,

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lkll_employee_date ON leaf_kanden_login_logs (employee_id, login_at DESC);
CREATE UNIQUE INDEX idx_lkll_one_per_day ON leaf_kanden_login_logs (
  employee_id,
  (login_at AT TIME ZONE 'Asia/Tokyo')::date
);
```

### 3.4 1 日 1 回の判定

- ユニークインデックスで日付重複防止
- 重複時はエラーで拒否、UI 側で「本日は記録済み」表示

---

## 4. Chatwork グループライン自動送信

### 4.1 送信内容

```
【稼働開始】山田太郎
日時: 2026-04-25 09:15
場所: 大阪府茨木市紫明園 ±25m
区分: 営業先（外出）
訪問先: 山田商事様
本日の予定: ...
```

### 4.2 送信条件

- 「Chatwork に送信」チェックボックス ON 時のみ
- 既定値: `root_employees.preferences.auto_send_geolocation_at_login` で個人設定
- グループライン ID は admin が設定（`bud_settings` 等）

### 4.3 Chatwork API 連携

```ts
import { sendChatworkMessage } from '@/lib/chatwork';

await sendChatworkMessage({
  roomId: KANDEN_GROUP_ROOM_ID,
  body: formatLoginMessage(loginLog),
});
```

- `spec-cross-chatwork` の Bot 経由送信パターン踏襲
- レート制限対応（5 req/sec、p-queue で逐次）

---

## 5. ログイン後ポップアップ（ロードマップ表示）

### 5.1 表示内容

Tree のログインポップアップに準拠:

```
┌──────────────────────────────────────────┐
│  おはようございます、山田太郎さん 🌅       │
│                                          │
│  本日のロードマップ                        │
│  ─────────                              │
│                                          │
│  📋 担当案件: 12 件                       │
│    🟢 進行中: 8 件                        │
│    🟡 対応待ち: 3 件                      │
│    🔴 期限間近: 1 件                      │
│                                          │
│  🆕 新着案件: 2 件（昨夕以降）              │
│  ⚠️ 関電からの対応依頼: 5 件                │
│                                          │
│  💡 本日の優先タスク:                       │
│   1. ◯◯案件の住所確認（期限: 4/27）        │
│   2. 関電 Excel 取込（5/2 期限）            │
│   3. 月次レポート作成（4/30）                │
│                                          │
│  ☐ 今日は表示しない                       │
│                                          │
│  [閉じる]                  [予定一覧 →]   │
└──────────────────────────────────────────┘
```

### 5.2 表示判定ロジック

```ts
function shouldShowRoadmap(employeeId: string): boolean {
  // localStorage に「YYYY-MM-DD-no-show」キーがあればスキップ
  const today = new Date().toISOString().slice(0, 10);
  const key = `leaf-kanden-roadmap-noshow-${employeeId}`;
  return localStorage.getItem(key) !== today;
}

function dismissRoadmapForToday(employeeId: string) {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(`leaf-kanden-roadmap-noshow-${employeeId}`, today);
}
```

### 5.3 データ取得

```sql
-- 担当案件サマリ
SELECT
  count(*) AS total_count,
  count(*) FILTER (WHERE status NOT IN ('completed', 'cancelled')) AS active_count,
  count(*) FILTER (WHERE status = 'awaiting_entry') AS awaiting_count,
  count(*) FILTER (WHERE deadline IS NOT NULL AND deadline <= now() + interval '3 days') AS urgent_count
FROM soil_kanden_cases
WHERE employee_number = :me
  AND deleted_at IS NULL;

-- 新着案件
SELECT count(*) FROM soil_kanden_cases
WHERE created_at >= now() - interval '12 hours'
  AND deleted_at IS NULL;

-- 関電依頼
SELECT count(*) FROM soil_kanden_external_requests
WHERE status = 'pending_match'
  AND deadline >= now()
  AND deleted_at IS NULL;
```

### 5.4 優先タスクの抽出ロジック

- 期限が近い順にソート
- 上位 3 件を表示
- 各タスクは詳細画面へのリンク付き

---

## 6. プライバシー配慮

### 6.1 位置情報の保存方針

- 緯度経度は精度 ±25m 程度に粗丸め可能（オプション）
- 個人特定の住所より「市区町村」レベルの情報のみ Chatwork 送信
- 詳細情報は Garden DB のみで保持

### 6.2 オプトイン

- 設定画面で「位置情報自動送信を OFF」可能
- OFF の場合は Chatwork 送信なし、Garden DB にも位置記録なし
- 業務上の必要性は東海林さん判断

### 6.3 GDPR 等への対応

- 国内利用前提だが、データ保管期間（90 日 デフォルト）
- 削除リクエストに対応（admin 操作で物理削除）

---

## 7. 設定画面（マイページ）

```
┌─────────────────────────────────────┐
│ 設定: ログイン時の動作                │
├─────────────────────────────────────┤
│ ☑ 位置情報を取得                      │
│ ☑ 稼働場所を入力                      │
│ ☑ グループラインに自動送信             │
│ ☑ ロードマップポップアップを表示       │
│                                     │
│ デフォルト稼働場所:                   │
│ ● 大阪本社  ○ 滋賀支店  ○ 在宅        │
│                                     │
│ [保存]                               │
└─────────────────────────────────────┘
```

---

## 8. RLS と権限

### 8.1 ログイン履歴

```sql
ALTER TABLE leaf_kanden_login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY lkll_select_self ON leaf_kanden_login_logs FOR SELECT
  USING (employee_id = auth_employee_number());

CREATE POLICY lkll_insert_self ON leaf_kanden_login_logs FOR INSERT
  WITH CHECK (employee_id = auth_employee_number());

-- manager+ は自部署の閲覧可（業務管理目的）
CREATE POLICY lkll_select_manager ON leaf_kanden_login_logs FOR SELECT
  USING (has_role_at_least('manager') AND is_same_department(employee_id));

CREATE POLICY lkll_all_admin ON leaf_kanden_login_logs FOR ALL
  USING (has_role_at_least('admin'));
```

### 8.2 位置情報の admin 確認

- 通常時: 本人 + manager+ のみ閲覧
- 緊急時: admin が確認可能（労務管理・出勤確認）

---

## 9. 実装ステップ

1. **Step 1**: `leaf_kanden_login_logs` migration + RLS（1h）
2. **Step 2**: Geolocation API + リバースジオコーディング（1h）
3. **Step 3**: ログイン後位置情報モーダル（許可確認込み）（1.5h）
4. **Step 4**: 稼働場所入力モーダル（1 日 1 回）（1h）
5. **Step 5**: Chatwork 自動送信（spec-cross-chatwork 経由）（1h）
6. **Step 6**: ロードマップポップアップ + データ取得（2h）
7. **Step 7**: 「今日は表示しない」localStorage（0.5h）
8. **Step 8**: 設定画面（マイページ統合、#06 と連携）（0.5h）
9. **Step 9**: 結合テスト + プライバシー配慮確認（0.5h）

**合計**: 約 **1.0d**（約 9h）

---

## 10. テスト観点

- 位置情報許可 / 拒否 / 後で の 3 パターン
- 1 日 1 回ユニーク制約（同日 2 回目はスキップ）
- 翌日 0 時境界の再表示
- ロードマップ「今日は表示しない」→ 翌日復活
- リバースジオコーディングのレート制限
- Chatwork 送信失敗時のリトライ
- 位置取得 timeout（10 秒）
- 設定画面の OFF → 正しくスキップ
- RLS: 他人のログイン履歴閲覧不可

---

## 11. パフォーマンス

| 指標 | 目標 |
|---|---|
| 位置取得 | < 5s（GPS 速い時）、< 10s（精度低い時）|
| リバースジオコーディング | < 2s |
| ロードマップデータ取得 | < 500ms |
| Chatwork 送信 | < 3s（API 経由）|

---

## 12. 判断保留事項

- **判1: 位置情報の精度**
  - 高精度（GPS）/ 低精度（市区町村）
  - **推定スタンス**: 高精度取得、UI 表示は市区町村粒度に丸め
- **判2: リバースジオコーディングサービス**
  - Nominatim（無料、レート制限）/ Mapbox / Google Maps
  - **推定スタンス**: Phase 1 は Nominatim（無料）、Phase 2 で Mapbox 検討
- **判3: ログイン履歴の保管期間**
  - 30 日 / 90 日 / 永続
  - **推定スタンス**: 90 日（労務管理に十分、容量節約）
- **判4: ロードマップの表示頻度**
  - 毎ログイン / 1 日 1 回 / ユーザー設定
  - **推定スタンス**: 1 日 1 回（既定）、ユーザー設定で毎ログイン可
- **判5: Chatwork 送信のオプト方式**
  - 既定 ON（OFF は明示）/ 既定 OFF
  - **推定スタンス**: 既定 ON（業務上の必要性）、設定で OFF 可
- **判6: グループラインの ID 管理**
  - admin 設定 / 環境変数
  - **推定スタンス**: admin 設定（`bud_settings` テーブル）
- **判7: GPS 取得失敗時のフォールバック**
  - スキップ / 手動入力強制
  - **推定スタンス**: 手動入力（位置の重要性高）

---

## 13. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| migration + RLS | 1.0h |
| Geolocation + 逆引き | 1.0h |
| 位置情報モーダル | 1.5h |
| 稼働場所モーダル | 1.0h |
| Chatwork 連携 | 1.0h |
| ロードマップポップアップ | 2.0h |
| localStorage 制御 | 0.5h |
| 設定画面統合 | 0.5h |
| 結合テスト | 0.5h |
| **合計** | **1.0d**（約 9h）|

---

— spec-leaf-kanden-ui-05 end —
