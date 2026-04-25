# Calendar C-04: Tree シフト連携（コール現場のシフト管理）

- 対象: Tree（架電アプリ）Phase B 完成後のシフト連携（event_type='shift'）
- 優先度: 🟡（Tree Phase B 完成後着手 = Phase D 期）
- 見積: **2.25d**（0.25d 刻み）
- 担当セッション: a-calendar（実装）/ a-tree（連携元）/ a-root（権限）/ a-bloom（レビュー）
- 作成: 2026-04-26（a-auto 006 / Batch 18 Calendar C-04）
- 前提:
  - **Sprout v0.2 spec §15**（Calendar 設計）
  - **Calendar C-01 / C-02**（基盤完了）
  - **Tree Phase B 完成**（架電現場のシフト管理 UI 実装済み）
  - 派遣スタッフ管理は Root 側マスタが完成済

---

## 1. 目的とスコープ

### 1.1 目的
- Tree（コールセンター）のシフト管理データを Garden カレンダーに統合表示する
- マネージャー / 管理者がシフト全体を月 / 週ビューで俯瞰できるようにする
- シフト勤怠と営業予定の干渉を視覚化（同時間帯の重複検知）
- event_type='shift' で Calendar に登録、`source='tree'` でリンク

### 1.2 含めるもの
- Tree シフトテーブル（tree_shifts 想定）→ Calendar 同期
- マネージャー向けシフト俯瞰ビュー
- スタッフ自身の自己シフト確認（Calendar の自分ビュー）
- シフト調整の Tree 側操作 → Calendar 反映
- シフト変更の通知（C-06 連携）

### 1.3 含めないもの
- シフト作成 UI（Tree 本体で実装）
- 勤怠記録（打刻）/ 残業時間管理（Bud 側）
- シフト希望提出 UI（Tree の別 spec）
- 給与計算連動（Bud B-01 で実装済 / 別経路）

---

## 2. 設計方針 / 前提

- **マスター**: Tree 側が常にマスター。Calendar からの逆方向書き込みは v1 では行わない（管理は Tree 一本化）
- **同期方向**: 単方向（tree → calendar）
- **トリガー**: Tree の `tree_shifts` テーブル INSERT/UPDATE/DELETE → トリガー → calendar_events 反映
- **対象範囲**: 過去 30 日 + 未来 90 日（Tree 側でも保持期間揃える）
- **派遣スタッフ**: 所属法人ごとに visibility='restricted' を分けるかは判断保留
- **複数拠点対応**: location 列で拠点名を保持、Calendar 側のフィルタに拠点軸を追加

---

## 3. 連携対象テーブル（想定）

```sql
-- Tree 側（C-04 では Tree 側既出を前提とする、ここでは仕様確認のみ）
tree_shifts (
  id uuid pk,
  staff_user_id uuid,
  location_id uuid,           -- 拠点
  shift_start_at timestamptz,
  shift_end_at timestamptz,
  break_minutes int,
  shift_type text,            -- 'regular' | 'overtime' | 'training' | 'cancelled'
  status text,                -- 'planned' | 'confirmed' | 'completed' | 'no_show'
  notes text,
  created_at, updated_at
);
```

---

## 4. 同期フロー

### 4.1 Tree → Calendar（順方向）

```
tree_shifts INSERT
  ↓ (Postgres TRIGGER trg_tree_shift_to_calendar)
calendar_events INSERT (
  event_type = 'shift',
  title = '{拠点名} シフト',
  start_at = shift_start_at,
  end_at = shift_end_at,
  owner_user_id = staff_user_id,
  attendee_user_ids = [staff_user_id],
  location = '{拠点名}（{住所}）',
  metadata = { shift_id, location_id, shift_type, break_minutes },
  status = (status='no_show' → 'cancelled', else 'confirmed'),
  visibility = 'restricted'  -- マネージャー以上のみ閲覧
)
  ↓
calendar_event_links INSERT (
  source='tree', source_table='tree_shifts', source_id=shift.id,
  link_direction='source_to_event'  -- 単方向
)
```

### 4.2 Tree 側変更の反映

| Tree 側変更 | Calendar 反映 |
|---|---|
| shift_start_at / shift_end_at UPDATE | start_at / end_at 同期 |
| status='completed' / 'no_show' | metadata に反映、status 維持または cancelled |
| shift_type='cancelled' | calendar_events.status='cancelled' |
| 削除 | calendar_events.status='cancelled' （物理削除しない） |

---

## 5. 表示仕様（Calendar 側）

### 5.1 シフト専用ビュー

`/calendar?view=week&filter=shift&location=osaka-ekimae`

- 週ビューでスタッフ × 時間帯のグリッド
- 色は橙（#f59e0b）
- マネージャーは全員、staff は自分のみ表示

### 5.2 重複検知

- 同じ owner_user_id で営業予定（sales_meeting）とシフト（shift）が重複した場合、UI で警告アイコン
- 重複検知は client side で計算、API 側でも `/api/calendar/conflicts` を提供

### 5.3 拠点フィルタ

- サイドバーに拠点リスト（複数選択）
- location_id ベースでフィルタ、metadata.location_id で絞り込み

---

## 6. 権限

| 操作 | 権限 |
|---|---|
| 自分のシフト閲覧 | staff 以上（owner_user_id = me） |
| 全員のシフト閲覧 | manager+（visibility='restricted' を覆う） |
| シフト編集 | Calendar からは不可、Tree 側のみ |
| シフト作成 | Calendar からは不可 |

---

## 7. API 仕様（C-04 用）

```
GET /api/calendar/events?type=shift&from=&to=&location_id=
POST /api/calendar/sync/tree-shift            -- 手動同期トリガー（admin）
GET /api/calendar/conflicts?user_id=&date=    -- 重複検知
```

---

## 8. 法令対応チェックリスト

- [ ] 労働基準法: シフトの 1 日 8h / 週 40h 上限を超える表示時に警告（v2 で実装、v1 は表示のみ）
- [ ] 労働基準法: 休憩時間 break_minutes の表示
- [ ] 派遣法: 派遣スタッフのシフトを混在表示する際に法人別色分け（visibility='restricted' で対応）
- [ ] 個人情報保護法: シフト履歴を退職後 3 年保管 → 物理削除禁止、論理削除のみ
- [ ] 36 協定: 残業（shift_type='overtime'）の月次合計を Bud 側に export（C-04 では API 提供のみ）

---

## 9. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | Tree `tree_shifts` 仕様確定（a-tree と摺合せ） | a-calendar + a-tree | 0.25d |
| 2 | Postgres トリガー `trg_tree_shift_to_calendar` | a-calendar | 0.50d |
| 3 | 同期失敗時のリトライ + ログ | a-calendar | 0.25d |
| 4 | シフト専用ビュー UI | a-calendar | 0.50d |
| 5 | 拠点フィルタ + サイドバー連携 | a-calendar | 0.25d |
| 6 | 重複検知（営業予定 ∩ シフト） | a-calendar | 0.25d |
| 7 | E2E テスト（Tree でシフト確定 → Calendar 反映） | a-calendar + a-tree | 0.25d |

合計: 2.25d

---

## 10. 判断保留事項

| # | 論点 | a-auto スタンス |
|---|---|---|
| 1 | 双方向同期の必要性 | v1 は単方向。Tree が日々のマスターなのでこれで十分。要望あれば v2 |
| 2 | 拠点別カラーリング | v1 は橙統一、v2 で拠点別色を導入 |
| 3 | シフト希望（提出段階）の表示 | v1 では tentative ステータスで表示、v2 で別ビュー |
| 4 | 派遣スタッフ別法人の表示制御 | manager 以上でも所属法人外は見せない方針要確認（要 Root 連携） |
| 5 | 残業表示の閾値警告 | v1 はアイコンのみ、合計時間ロジックは v2 |
| 6 | スマホでのシフト確認 | C-05 で対応（閲覧のみ） |

---

## 既知のリスクと対策

- **リスク 1**: Tree シフト機能が Phase D まで未実装 → 本 spec は Tree Phase B 完成後発動。それまでは calendar_events.event_type='shift' を利用しない
- **リスク 2**: 大規模拠点（数百人）のシフト同期負荷 → Edge Function でバッチ化、1 トランザクション 100 行制限
- **リスク 3**: シフト変更頻度の高さによる通知過多 → C-06 連携で 1 時間内の連続変更は集約通知
- **リスク 4**: 重複検知の誤検知（休憩時間が営業予定と被る等） → break_minutes を考慮した interval 演算
- **リスク 5**: タイムゾーン混在（深夜シフト） → start_at < end_at 維持、日跨ぎは end_at を翌日 timestamptz で保持

---

## 関連ドキュメント

- `docs/specs/2026-04-26-calendar-C-01-migrations.md`
- `docs/specs/2026-04-26-calendar-C-02-business-schedule-ui.md`
- `docs/specs/2026-04-26-calendar-C-06-notifications.md`
- 想定: Tree Phase B シフト管理 spec（a-tree が後日策定）

---

## 受入基準（Definition of Done）

- [ ] Tree で `tree_shifts` を INSERT すると Calendar に event_type='shift' が自動生成される
- [ ] `calendar_event_links` に source='tree' のリンクが記録される
- [ ] Tree 側でシフト時刻変更すると Calendar の start_at / end_at が更新される
- [ ] Tree 側で shift_type='cancelled' にすると Calendar の status='cancelled' になる
- [ ] Calendar 側からシフト編集ボタンが押せない（UI で disable）
- [ ] manager+ で全員のシフトが俯瞰できる、staff は自分のシフトのみ
- [ ] 拠点フィルタで location_id ごとに絞り込める
- [ ] 同じスタッフで営業予定とシフトが重複している場合、警告アイコンが表示される
- [ ] `/api/calendar/conflicts` エンドポイントで重複イベント一覧が取得できる
- [ ] 派遣スタッフのシフトが visibility='restricted' で適切に制御される
- [ ] レビュー（a-tree + a-bloom）承認 + Tree Phase B β 期間中に動作確認
