# Tree Phase D-04: トスアップ連携（Tree → Leaf 案件化）

- 対象: オペレーターが「トス」ボタンを押した後、Leaf（商材別アプリ）に案件として引継ぐフロー
- 優先度: **🔴 高**（Tree の営業成果を Leaf に確実に渡す結節点）
- 見積: **0.7d**
- 担当セッション: a-tree（+ a-leaf 連携）
- 作成: 2026-04-25（a-auto / Batch 9 Tree Phase D #04）
- 改訂: **2026-04-26（a-main 006）— 判断保留 7 件すべて確定 + toss 集中原則 + 既存 `/tree/toss-wait` `/tree/calling/sprout` 統合**
- 前提:
  - D-01（`tree_call_records.tossed_leaf_case_id` 列）
  - D-02（Sprout 画面「トス」ボタン → 本フロー起動）
  - spec-leaf-kanden-phase-c-03-input-ui-enhancement（Leaf 側受信フロー）
  - spec-cross-chatwork-notification（案 D 準拠）
  - **新規連携**:
    - `spec-tree-toast-notification.md`（トス完了結果の即時 Toast = toss UI のフィードバック源）
    - 既存 `/tree/toss-wait`（既設、closer 空き状況 + 1 秒経過タイマー）— **本 spec で正式化**
    - 既存 `/tree/calling/sprout`（既設、トス時メモ必須）— **本 spec で同意確認 + メモ必須仕様を明文化**

---

## 0. 2026-04-26 確定事項（a-main 006、東海林承認）

| # | 項目 | 確定内容 |
|---|---|---|
| 0-1 | 他商材（光・クレカ）対応時期 | **Phase D-1 は関電のみ / D-2 は光（D-1+D-2 セットリリース戦略の D-2 = ソフトフォンに加え光商材を含む）/ D-3 はクレカ**（2026-04-26 a-main 確定 #19 A 採択、優先度: 関電 > 光 > クレカ）。プラン §4 D-1+D-2 セットリリース戦略と整合 |
| 0-2 | トス後 Tree 側の編集権限 | **不可（原本性保持）。補足は Leaf review_note で追記** |
| 0-3 | トス取消機能 | **不可。誤トスは Leaf 事務から cancel 依頼** |
| 0-4 | 同意確認の必須化 | **全商材で必須（景表法・特商法対応）** |
| 0-5 | キャンペーンごとの事務チーム振り分け | **振り分け、`campaign_code → chatwork_room_id` マッピング管理** |
| 0-6 | トスアップのピーク負荷 | **1 関数 < 200ms で 1 時間に 18,000 件捌ける、問題なし** |
| 0-7 | Tree 側状態 poll の頻度 | **closer 状況: 5 分 poll（toss UI から非表示）+ トス完了結果: 即時反映**（Phase D-1: 30 秒 polling、Phase D-2: Supabase Realtime） |

### 業務設計原則（最重要）

#### 🔥 toss は集中させる（memory `project_tree_toss_focus_principle.md` 準拠）

**Garden Tree のトス（toss）役割は「契約見込みあり → トスを上げる」だけに集中**させる業務設計が原則。closer の空き状況・混雑度は **toss UI に表示しない**（変な思考をさせない）。

**禁止事項（NG パターン）**:
- ❌ `/tree/calling/sprout` 等の toss 架電画面に **closer 空き状況・closer 個別状況を表示しない**
- ❌ 「closer 全員 busy 中、5 件キュー溜まってます」等の警告を toss UI に表示しない
- ❌ closer 状況による toss ボタンの活性化制御（busy 時にトス不可等）はしない

**OK パターン**:
- ✅ toss は架電結果ボタン（受注 / 見込み / トス / NG 等）を押すだけ
- ✅ トスを押したら即サーバーにキュー追加、closer 空き次第で自動割当
- ✅ closer 状況の可視化は **`/tree/toss-wait` 画面（マネージャー / 事務向け）にのみ表示**
- ✅ トス押下時は「ありがとうございます！」等の即時 Toast でモチベーション維持
- ✅ **トス完了結果（成約 / NG / 見込み 等）は即時反映 → Toast 通知で表示**（Phase D-1: 30 秒 polling、D-2: Supabase Realtime）

#### 役割の責務分離

| 役割 | 集中すべきこと | 見せないこと |
|---|---|---|
| **toss** | 架電 + 結果判定 + トス上げ | closer 空き、closer 待ち時間、closer 個別状況 |
| **closer** | トス受け + クロージング | toss キュー全体、トッサー別件数 |
| **manager+** | 全体監視 + 介入 | (必要なら全部見える) |

### 既存実装との整合性

#### `/tree/calling/sprout`（既存、toss UI）
- **既存実装**: 架電結果ボタン（受注 / 見込み / トス / NG / 担当者不在 / 不在 / 拒否 等）+ トス時メモ必須
- **本 spec で正式化**:
  - 架電結果ボタンは `tree_call_records.result_code` の CHECK 制約に同期（D-01 §0 判 0-2）
  - トス時メモ必須: `tree_call_records.memo NOT NULL CHECK (length(memo) > 0)` 相当のフロント検証
  - **トス押下後の即時 Toast**「ありがとうございます！クローザーへ転送中...」
  - **closer 状況非表示**（判 0-7 + toss 集中原則）
  - 同意確認チェックボックス（判 0-4 全商材必須）

#### `/tree/toss-wait`（既存、closer 空き状況 + 1 秒経過タイマー）
- **既存実装**: closer 待機画面（manager / 事務向け、closer 空き状況の可視化、1 秒経過タイマー）
- **本 spec で正式化**:
  - 表示権限: **manager+ のみ**（toss / closer は閲覧不可）
  - 30 秒 polling で closer 状況更新（D-03 判 0-2 と整合）
  - トス完了結果は本画面でも閲覧可能だが、toss 用ではなく manager 用

### 商材別事務チーム振り分け（判 0-5）

`campaign_code → chatwork_room_id` のマッピングを `root_settings` で管理：

```sql
-- 例
INSERT INTO root_settings (key, value, description) VALUES
  ('toss_chatwork_routing.kanden', '"ROOM_KANDEN_BACKOFFICE"', '関電商材トス通知先'),
  ('toss_chatwork_routing.hikari_xxx', '"ROOM_HIKARI_BACKOFFICE"', '光回線商材トス通知先'),
  ('toss_chatwork_routing.default', '"ROOM_DEFAULT"', '未マッピング商材のフォールバック');
```

トス成立時、`campaign_code` から該当ルームを引いて Chatwork 通知を送る。

---

## 1. 目的とスコープ

### 目的

Tree で獲得したアポ情報（顧客情報・通話メモ・同意確認）を、**欠落なく Leaf に渡す**。失敗時の再送・ロールバックも含めた堅牢な設計。

### 含める

- トス情報のペイロード設計（顧客 / 通話メモ / 同意 / メタ）
- Tree → Leaf 書き込み経路（Server Action + トランザクション）
- トス失敗時のリトライ・ロールバック
- Leaf 側受信フロー（Leaf C-03 input-ui との接続点）
- Chatwork 通知（案 D 準拠、署名 URL 不流通）
- 案件化後の Tree 側追跡（tossed_leaf_case_id + 状態同期）

### 含めない

- Leaf 案件の後続処理（事務入力、関電提出等）= Leaf C 担当
- トスアップ統計集計（D-05 で別途）
- 商材横断（関電以外）のトス先振り分けロジック詳細（§判断保留）

---

## 2. 既存実装との関係

### 2.1 Tree 側のトリガー

- D-02 Sprout 画面の「トス」ボタン → `handleToss()` が起動
- 直前の `tree_call_records` INSERT と連動（同一トランザクション想定）

### 2.2 Leaf 側の受信口

spec-leaf-kanden-phase-c-03-input-ui-enhancement §5「事務入力ウィザード Step 1」:

- Leaf 側は `soil_kanden_cases` INSERT を受けて、事務入力ウィザード Step 1 を開く
- 初期値として Tree 由来情報（顧客名・電話・架電メモ）が pre-fill される

### 2.3 他商材への対応

- Phase D-1 は **関電業務委託のみ**対応
- 光回線・クレカ等は `campaign_code → leaf_table` のマッピング表で拡張予定

---

## 3. トス情報のペイロード設計

### 3.1 ペイロード構造

```typescript
type TossPayload = {
  // 必須: 営業コンテキスト
  session_id: string;          // tree_calling_sessions
  call_id: string;             // tree_call_records
  campaign_code: string;       // 'kanden' | 'hikari' | 'credit'
  employee_id: string;         // オペレーター社員番号
  tossed_at: string;           // ISO timestamp

  // 必須: 顧客情報
  customer_name: string;
  customer_phone: string;
  customer_address?: string;

  // 必須: 同意確認
  agreement_confirmed: boolean;
  agreement_memo?: string;     // 同意内容の要約

  // 任意: 通話メモ
  call_memo?: string;
  call_duration_sec?: number;

  // 任意: Soil リスト連携
  list_id?: number;

  // 商材別追加情報（関電の場合）
  kanden_extra?: {
    supply_point_number?: string;   // 供給地点特定番号 22 桁
    current_contract?: 'kanden' | 'other';
    preferred_contact_time?: string;
  };
};
```

### 3.2 データソース

| 項目 | ソース |
|---|---|
| session_id / call_id | Tree session 直後 |
| customer_name / phone / address | `soil_call_lists` 経由 |
| agreement_confirmed | オペレーター画面のチェックボックス（必須）|
| agreement_memo | トス確定時のモーダル入力 |
| call_memo | `tree_call_records.memo` |
| list_id | `tree_call_records.list_id` |
| kanden_extra.* | 商材別の追加入力画面（§4.2）|

---

## 4. Tree → Leaf 書き込み経路

### 4.1 2 段階ウィザード（Leaf A-2 パターン踏襲）

```
┌───────────────────────────────────────────┐
│ Step 1: 同意確認                           │
│ ──────                                    │
│ ☐ 同意取得済み                             │
│ ☐ 次回架電希望を確認                        │
│ 同意内容メモ: [                     ]      │
│ [ キャンセル ]              [ 次へ → ]      │
└───────────────────────────────────────────┘
         ↓
┌───────────────────────────────────────────┐
│ Step 2: 商材別情報（関電の場合）             │
│ ──────                                    │
│ 供給地点特定番号: [                   ]     │
│ 現在の契約: ○ 関電  ○ その他               │
│ 希望連絡時間帯: [                   ]       │
│ [ ← 戻る ]              [ トス送信 ]        │
└───────────────────────────────────────────┘
```

- Step 2 は商材コードで切り替え（Phase D-1 は関電のみ、他は Phase D-2）
- `required` 欄が未入力なら「トス送信」ボタン無効

### 4.2 Server Action（Tree 側）

```typescript
// src/app/tree/calling/_actions/tossToLeaf.ts（実装 a-tree が担当）
'use server';

export async function tossToLeaf(payload: TossPayload): Promise<TossResult> {
  // 1. 入力検証（zod）
  const parsed = TossPayloadSchema.parse(payload);

  // 2. トランザクション開始
  const { data, error } = await supabase.rpc('tree_toss_to_leaf', {
    payload: parsed,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, leaf_case_id: data.leaf_case_id };
}
```

### 4.3 PostgreSQL 関数（トランザクション境界）

```sql
CREATE OR REPLACE FUNCTION tree_toss_to_leaf(payload jsonb)
RETURNS TABLE (leaf_case_id uuid) AS $$
DECLARE
  v_case_id uuid;
  v_call_id uuid := (payload->>'call_id')::uuid;
  v_employee_id text := payload->>'employee_id';
  v_campaign_code text := payload->>'campaign_code';
BEGIN
  -- 重複チェック
  IF EXISTS (
    SELECT 1 FROM tree_call_records
    WHERE call_id = v_call_id AND tossed_leaf_case_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This call is already tossed';
  END IF;

  -- Leaf 側 INSERT（関電の場合）
  IF v_campaign_code = 'kanden' THEN
    INSERT INTO soil_kanden_cases (
      case_id, status, employee_number, name,
      customer_name, customer_phone,
      acquisition_type, case_type,
      supply_point_22,
      review_note, submitted_by, submitted_at
    ) VALUES (
      gen_random_uuid(), 'ordered', v_employee_id, payload->>'employee_name',
      payload->>'customer_name', payload->>'customer_phone',
      'dakkan', 'latest',
      payload->'kanden_extra'->>'supply_point_number',
      payload->>'call_memo', v_employee_id, now()
    )
    RETURNING case_id INTO v_case_id;

  -- 他商材は Phase D-2 で拡張
  ELSE
    RAISE EXCEPTION 'campaign % not yet supported', v_campaign_code;
  END IF;

  -- Tree 側 UPDATE（結果と Leaf case_id を接続）
  UPDATE tree_call_records
  SET tossed_leaf_case_id = v_case_id
  WHERE call_id = v_call_id;

  -- 監査ログ
  INSERT INTO audit_logs (event_type, actor, data)
  VALUES ('tree.toss', v_employee_id, payload || jsonb_build_object('leaf_case_id', v_case_id));

  RETURN QUERY SELECT v_case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- `SECURITY DEFINER` で両テーブルへの書き込み権限を関数に封じ込める
- 失敗時は自動で ROLLBACK（Tree UPDATE / Leaf INSERT / 監査 すべて）

---

## 5. トス失敗時のリトライ・ロールバック

### 5.1 失敗パターン

| パターン | 原因 | 対処 |
|---|---|---|
| ネットワーク断 | WiFi 落ち | オフラインキュー（D-02 §5 流用） |
| Leaf 側制約違反 | 必須欄不足 | エラー Toast、ウィザード復帰 |
| 重複トス | 同 call_id 2 回送信 | DB 層で弾き（§4.3 EXISTS チェック） |
| DB 障害 | Supabase ダウン | Chatwork アラート + 手動リトライ |
| 同意未取得 | agreement_confirmed = false | Step 1 で送信ブロック |

### 5.2 ロールバック仕様

- `tree_toss_to_leaf` は 1 関数 = 1 トランザクション、途中失敗で全 ROLLBACK
- Tree 側 UPDATE のみ成功 / Leaf 側 INSERT のみ成功 の中途半端状態を作らない

### 5.3 リトライ仕様

- Tree 側ウィザード Step 2「トス送信」押下後の失敗は **同画面で再試行**可能（ウィザード状態保持）
- 3 回連続失敗で「後で再送」モード（localStorage キュー）
- キュー再送は D-02 §5 オフラインキューと同機構（`tree_offline_queue_v1` 内に `{ type: 'toss', payload }`）

### 5.4 部分成功のリカバリ

- 仮に Leaf INSERT 成功 + Tree UPDATE 失敗（関数外のネット断）の場合:
  - Leaf 側 `case_id` が存在しても、Tree 側から孤児状態で見える
  - 夜間バッチ（§8 整合性ジョブ）で Tree 側 `tossed_leaf_case_id` を逆引き補正

---

## 6. Leaf 側受信フロー

spec-leaf-kanden-phase-c-03-input-ui-enhancement §5 を前提に、Tree 由来トスは以下を特別扱い：

### 6.1 事務タブの新着フィルタ

- `/leaf/backoffice` にて `status = 'ordered'` かつ `submitted_at` 直近 1 時間の案件を「🆕 NEW」マーク
- Tree トス由来のものは `review_note` に「[Tree トス][session_id][call_id]」を prefix

### 6.2 事務が入力開始する際

- 案件クリック → Step 1 ウィザード起動
- pre-fill 値: 顧客名・電話・供給地点・call_memo（営業メモ）
- 事務が追加入力: 契約種別・検針日・月間使用量 等（Leaf C-01 §3 参照）

### 6.3 同意確認の表示

- Tree で取得した `agreement_confirmed` と `agreement_memo` を**読み取り専用**で表示
- 事務からは編集不可（Tree 側の原本性保持）

---

## 7. Chatwork 通知（案 D 準拠）

### 7.1 通知パターン

| トリガー | 宛先 | 本文（例） |
|---|---|---|
| トス成立 | 事務チーム DM | "◯◯案件（顧客: 山田太郎様）が Tree からトスアップされました。Garden Leaf にてご確認ください。" |
| トス失敗（3 連続）| 該当オペレーター DM | "トスアップが連続失敗しています。Garden Tree で再送してください。" |
| 重大失敗（DB 障害）| admin DM | "Tree → Leaf トスアップでシステム障害発生。管理者対応が必要です。" |

### 7.2 本文ポリシー

- **署名 URL 不流通**（案 D 準拠）
- Garden ログイン URL のみ記載: `https://garden.hyuaran.com/leaf/backoffice`
- 顧客氏名は本文に含めて OK（Chatwork は社内限定の DM）
- 電話番号・住所は本文に含めない（漏洩リスク低減）

### 7.3 送信タイミング

- Server Action 成功直後に enqueue（p-queue 経由、spec-cross-chatwork §6）
- 失敗しても業務は継続（Chatwork は補助通知のため）

---

## 8. Tree 側の案件追跡

### 8.1 オペレーター画面への反映

- トス成功後、Sprout 画面の「直近結果」欄に「✅ トス成立 (Leaf)」表示
- ドリルダウン可: Leaf 案件の現在ステータス（8 段階）を Tree 側から参照
- 営業は Leaf に直接ログインしなくても、自分のトスがどこまで進んだか見える

### 8.2 状態同期

- `soil_kanden_cases.status` が変化したら、同テーブルの `last_updated_at` を Tree 側が定期 poll
- Phase D-1 は 5 分間隔 poll、D-2 で Realtime Postgres Changes 移行検討

### 8.3 ステータス表示例

| Leaf status | Tree 画面表示 |
|---|---|
| ordered | 📋 事務入力待ち |
| submitted | 📮 関電提出済 |
| ng_by_kanden | ❌ 関電 NG |
| accepted | ✅ 関電承認 |
| cancelled | 🚫 キャンセル |
| completed | 🎉 完了（入金済）|

---

## 9. 整合性ジョブ（夜間バッチ）

### 9.1 目的

Tree INSERT と Leaf INSERT の片方だけ成功した中途半端状態を検出・補正。

### 9.2 検査ロジック

```sql
-- 1. Tree にトス印はあるが Leaf に case がない
SELECT call_id, tossed_leaf_case_id
FROM tree_call_records
WHERE tossed_leaf_case_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM soil_kanden_cases
    WHERE case_id = tossed_leaf_case_id
  );

-- 2. Leaf case はあるが Tree に逆参照なし
SELECT c.case_id, c.review_note
FROM soil_kanden_cases c
WHERE c.review_note LIKE '[Tree トス]%'
  AND c.submitted_at > now() - interval '1 day'
  AND NOT EXISTS (
    SELECT 1 FROM tree_call_records
    WHERE tossed_leaf_case_id = c.case_id
  );
```

### 9.3 補正

- ケース 1: Tree 側の `tossed_leaf_case_id` を null に戻す + Chatwork 通知
- ケース 2: `review_note` から call_id を抽出し、Tree 側を UPDATE

### 9.4 実行

- Vercel Cron: 日次 23:30 JST（`0 14 * * *` UTC）
- 差分 > 10 件で admin Chatwork アラート

---

## 10. 実装ステップ

1. **Step 1**: `TossPayloadSchema`（zod）定義（0.5h）
2. **Step 2**: `tree_toss_to_leaf` PostgreSQL 関数（1h）
3. **Step 3**: Tree 側 Server Action + ウィザード Step 1/2 UI（2h）
4. **Step 4**: Chatwork 通知連携（spec-cross-chatwork 利用、0.5h）
5. **Step 5**: Tree 側「直近結果」表示 + Leaf ステータス poll（1h）
6. **Step 6**: 整合性ジョブ（Cron + 補正ロジック、0.5h）
7. **Step 7**: エラー時リトライ・オフラインキュー統合（0.5h）
8. **Step 8**: 結合テスト（Tree → Leaf 往復、1h）

**合計**: 約 **0.7d**（約 7h）

---

## 11. テスト観点

詳細は D-06 §3。本 spec 固有：

- 正常系: トス成立 → Leaf 案件生成 → Chatwork 通知 送信確認
- 重複トス: 同一 `call_id` で 2 回実行 → エラー返却
- 同意未取得: Step 1 で送信ブロック確認
- Leaf 側制約違反: 必須欄不足 → Tree/Leaf 共に ROLLBACK 確認
- ネット断: オフラインキュー化 → 復帰時 flush 確認
- 整合性ジョブ: 意図的に片側のみ失敗させた状態から補正を検証

---

## 12. 判断保留事項（2026-04-26 全件確定済 — 履歴保持）

> 全 7 件の確定内容は §0 を正典とする。

- **判1（確定）: 他商材対応時期** — 確定: D-1 関電のみ、D-2/D-3 で他商材（推定通り）
- **判2（確定）: トス後 Tree 側の編集権限** — 確定: 不可、補足は Leaf review_note（推定通り）
- **判3（確定）: トス取消機能** — 確定: 不可、Leaf 事務から cancel 依頼（推定通り）
- **判4（確定）: 同意確認の必須化** — 確定: 全商材で必須（景表法・特商法対応）（推定通り）
- **判5（確定）: 商材別事務チーム振り分け** — 確定: `campaign_code → chatwork_room_id` マッピング管理（`root_settings` で運用変更可、§0 参照）
- **判6（確定）: ピーク負荷** — 確定: 1 関数 < 200ms で 18,000 件/時 OK（推定通り）
- **判7（確定）: Tree 側状態 poll 頻度** — **確定: closer 状況 = 5 分 poll（toss UI から非表示）+ トス完了結果 = 即時反映** — 当初推定（5 分固定）から **二段階方針へ進化**: closer 状況は toss UI に表示しない（toss 集中原則、§0）。トス完了結果は即時反映で Toast 通知（D-1: 30 秒 polling、D-2: Supabase Realtime）。memory `project_tree_toss_focus_principle.md` 教訓反映

---

## 13. 実装見込み時間の内訳

| 作業 | 見込 |
|---|---|
| ペイロード設計（zod）+ PG 関数 | 1.5h |
| Tree 側 Server Action + ウィザード | 2.0h |
| Chatwork 通知連携 | 0.5h |
| Leaf 状態 poll + 表示 | 1.0h |
| 整合性ジョブ | 0.5h |
| エラー処理・オフラインキュー統合 | 0.5h |
| 結合テスト | 1.0h |
| **合計** | **0.7d**（約 7h）|

---

— spec-tree-phase-d-04 end —
