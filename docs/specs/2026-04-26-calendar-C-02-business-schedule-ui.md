# Calendar C-02: 営業予定管理 UI（FullCalendar v6）

- 対象: Garden カレンダーの営業予定管理 UI（月/週/日表示・ドラッグ操作・staff 以上）
- 優先度: 🔴
- 見積: **2.50d**（0.25d 刻み）
- 担当セッション: a-calendar（実装）/ a-root（権限）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Calendar C-02）
- 前提:
  - **Sprout v0.2 spec §15**（Calendar 設計）
  - **Calendar C-01**（Migration 完了）
  - FullCalendar v6 npm 導入承認（要確認、ライセンス: MIT 系 + Premium 不要範囲）

---

## 1. 目的とスコープ

### 1.1 目的
- 営業（sales_meeting）/ 個人（personal）/ その他（other）系の予定管理 UI を提供する
- 月 / 週 / 日 切替、ドラッグ操作、複製、参加者追加を 1 画面で完結
- staff 以上に閲覧・入力を許可、toss / closer / cs は完全にメニュー非表示

### 1.2 含めるもの
- `/calendar` トップ画面（FullCalendar v6 描画）
- 予定作成 / 編集 / 削除（cancel）モーダル
- 月 / 週 / 日 / リスト 4 ビュー切替
- ドラッグで時刻変更 / リサイズで時間延長
- イベント色分け（event_type 別 + ユーザー別 override）
- 参加者ピッカー（社員一覧から複数選択）
- フィルタ（owner / event_type / 自分が参加）

### 1.3 含めないもの
- 面接スロット連携（C-03 で扱う）
- シフト管理（C-04 で扱う）
- スマホ閲覧モード（C-05 で扱う）
- 通知設定 UI（C-06 で扱う）
- 繰り返し予定（v2 に延期）

---

## 2. 設計方針 / 前提

- **採用ライブラリ**: FullCalendar v6（Standard plugins: dayGrid / timeGrid / list / interaction）。Premium（resourceTimeline 等）は不要
- **データ取得**: `/api/calendar/events?from=&to=&type=` で範囲取得、SWR / TanStack Query でキャッシュ
- **書き込み**: ドラッグ完了時に `PATCH /api/calendar/events/:id`、楽観更新 + ロールバック
- **権限**: `useAuthRole` フックで staff 未満は `/calendar` 自体に到達不可（middleware で 403）
- **国際化**: 日本語ロケール固定、曜日表示「日 月 火 水 木 金 土」
- **デザイン**: Tailwind ベース、既存 Garden コンポーネント Button/Modal/Input を再利用

---

## 3. 画面構成

### 3.1 ルーティング

```
/calendar                    … トップ（月表示既定）
/calendar?view=week
/calendar?view=day&date=2026-05-01
/calendar/events/new         … 新規作成（Modal でも可）
/calendar/events/:id         … 詳細・編集
```

### 3.2 トップ画面レイアウト

```
+----------------------------------------------------------+
| Garden カレンダー                          [+ 新規予定]  |
+--------+-------------------------------------------------+
| 左サイド | 月 | 週 | 日 | リスト |   ← ▶ 今日           |
| ・ミニ月 |                                              |
| ・フィル |       FullCalendar 本体                     |
| ・凡例   |                                              |
+--------+-------------------------------------------------+
```

### 3.3 主要コンポーネント

- `<CalendarShell>`: 全体レイアウト
- `<CalendarSidebar>`: ミニカレンダー / フィルタ / 凡例
- `<CalendarMain>`: FullCalendar v6 wrapper
- `<EventEditorModal>`: 作成・編集モーダル
- `<EventDetailPopover>`: クリック時のポップオーバー
- `<AttendeePicker>`: 参加者選択
- `<EventTypeBadge>`: 種別チップ

---

## 4. UX 仕様

### 4.1 ビュー切替

| ビュー | 既定 / トリガ | 表示範囲 |
|---|---|---|
| 月 | 既定 | 当月 + 前後合わせ 6 週 |
| 週 | ボタン | 当週月〜日 |
| 日 | ボタン | 当日 |
| リスト | ボタン | 直近 14 日 |

### 4.2 イベント操作

| 操作 | 挙動 |
|---|---|
| 空白セルクリック | 新規予定モーダル（start_at プリセット） |
| イベントクリック | 詳細ポップオーバー（編集 / 削除 / 複製） |
| ドラッグ移動 | start_at / end_at を更新、楽観 UI |
| リサイズ（端ドラッグ） | end_at のみ更新 |
| Shift + ドラッグ | 複製 |
| Delete キー | cancel 確認モーダル |

### 4.3 色分け既定（event_type）

| event_type | 色 |
|---|---|
| sales_meeting | #2563eb（青） |
| interview | #16a34a（緑） |
| shift | #f59e0b（橙） |
| personal | #6b7280（灰） |
| other | #94a3b8 |

`color_hex` が個別指定されていればそちらを優先。

### 4.4 フィルタ

- event_type 複数選択
- owner 単一選択（自分 / 他人 / 全員）
- attendee に自分を含むのみ
- visibility（public / restricted の閲覧可能分のみ）

---

## 5. API 仕様（C-02 用）

### 5.1 一覧取得

```
GET /api/calendar/events?from=2026-05-01&to=2026-05-31&type=sales_meeting,personal
→ 200 { events: [...] }
```

### 5.2 作成

```
POST /api/calendar/events
Body: {
  event_type: 'sales_meeting',
  title: 'A社 訪問',
  start_at: '2026-05-10T13:00:00+09:00',
  end_at: '2026-05-10T14:00:00+09:00',
  location: '東京都渋谷区...',
  attendee_user_ids: ['uuid1', 'uuid2'],
  visibility: 'public'
}
→ 201 { event }
```

### 5.3 更新（ドラッグ反映）

```
PATCH /api/calendar/events/:id
Body: { start_at, end_at }
→ 200 { event }
```

### 5.4 cancel

```
PATCH /api/calendar/events/:id/cancel
→ 200 { event: { status: 'cancelled' } }
```

---

## 6. 権限ロジック

```ts
// middleware.ts 抜粋（疑似コード、実装は別）
if (pathname.startsWith('/calendar')) {
  if (!user) return redirect('/login');
  if (!hasRole(user, ['staff', 'manager', 'admin', 'super_admin'])) {
    return new Response('Forbidden', { status: 403 });
  }
}
```

- 編集ボタンは `owner === me || hasRole('admin+')` のみ表示
- 削除（DELETE 物理）は admin+ のみ、通常 UI は cancel ボタンのみ

---

## 7. 法令対応チェックリスト

- [ ] 個人情報保護法: 参加者表示は社内ユーザーのみ、外部メールアドレス入力は v1 で塞ぐ（場所欄へのフリーテキストは可）
- [ ] 派遣法: 派遣社員の予定が混じる場合は visibility='restricted' を既定に
- [ ] 労働時間管理: 営業予定の合計時間を export 可能にする（v2 想定、API のみ用意）

---

## 8. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | FullCalendar v6 npm 導入承認取り + 設定 | a-calendar | 0.25d |
| 2 | `/calendar` ルート + middleware 権限制御 | a-root + a-calendar | 0.25d |
| 3 | `<CalendarShell>` / `<CalendarSidebar>` レイアウト | a-calendar | 0.25d |
| 4 | `<CalendarMain>` FullCalendar wrapper（ビュー切替） | a-calendar | 0.50d |
| 5 | `/api/calendar/events` GET / POST / PATCH / cancel | a-calendar | 0.50d |
| 6 | `<EventEditorModal>` + `<AttendeePicker>` | a-calendar | 0.25d |
| 7 | ドラッグ / リサイズ / Shift+ドラッグ複製 | a-calendar | 0.25d |
| 8 | フィルタ（type / owner / attendee） | a-calendar | 0.25d |

合計: 2.50d

---

## 9. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 1 | FullCalendar v6 採用 vs 自社実装 | v1 は FullCalendar v6（実装速度優先）。npm 承認必須 |
| 2 | 月をまたぐ複数日イベントの表示 | v1 はサポート、長期予定は dayGrid 既定動作で OK |
| 3 | 会議室予約との連動 | v1 では location テキストのみ、会議室マスタ化は v2 |
| 4 | タイムゾーン UI 表示切替 | v1 は Asia/Tokyo 固定、海外拠点ができたら検討 |
| 5 | カレンダー印刷 / PDF 書き出し | v1 では含めない、ブラウザ印刷依存 |
| 6 | スマホでの編集可否 | v1 は閲覧のみ（C-05）、編集は PC のみ |

---

## 既知のリスクと対策

- **リスク 1**: FullCalendar v6 のバンドルサイズ（~200KB） → 動的 import で `/calendar` に到達するまで遅延ロード
- **リスク 2**: 大量イベント（数百/月）描画パフォーマンス → 月表示は 1 セルあたり最大 4 件 + 「+n more」リンク
- **リスク 3**: ドラッグ更新失敗時のロールバック → 楽観 UI + エラー時 `toast` + 元位置に戻す
- **リスク 4**: 同時編集の競合 → updated_at をバージョンとして PATCH 時に if-match、競合時はリロード提案
- **リスク 5**: 長文 description によるポップオーバー崩れ → 200 文字でフォールド、続きは詳細画面

---

## 関連ドキュメント

- `docs/specs/2026-04-26-calendar-C-01-migrations.md`
- `docs/specs/2026-04-26-calendar-C-03-interview-slot-sync.md`
- `docs/specs/2026-04-26-calendar-C-05-mobile-view.md`
- `docs/specs/2026-04-26-calendar-C-06-notifications.md`

---

## 受入基準（Definition of Done）

- [ ] `/calendar` で月 / 週 / 日 / リストの 4 ビューが切り替えできる
- [ ] 空白セルクリックで新規予定モーダルが開き、start_at がプリセットされる
- [ ] 作成した event_type=sales_meeting の予定が青色で表示される
- [ ] イベントをドラッグして時刻変更すると DB が更新される
- [ ] イベントを Shift+ドラッグで複製できる
- [ ] フィルタで event_type=personal のみ表示できる
- [ ] toss / closer / cs ロールで `/calendar` にアクセスすると 403 になる
- [ ] staff ロールで `/calendar` 閲覧 + 自分の予定編集ができる
- [ ] 他人の private 予定は staff から見えない
- [ ] cancel した予定が status='cancelled' でグレーアウト表示される
- [ ] 参加者ピッカーで複数選択した uuid が attendee_user_ids[] に保存される
- [ ] レビュー（a-bloom）承認 + α版で東海林さん操作確認
