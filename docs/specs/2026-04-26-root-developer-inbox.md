# Root Dev-Inbox: Garden 内 開発者ページ 仕様書

- 対象: Garden 全モジュール横断の問い合わせ・ヘルプ修正依頼を一元管理する開発者専用画面
- パス: **`/admin/dev-inbox`**
- 見積: **2.25d**（W1〜W7 合計、§13 参照）
- 担当セッション: a-root
- 作成: 2026-04-26（a-root / decisions-pending-batch-20260426 Cat 2 #14 拡張）
- 根拠: `C:\garden\_shared\decisions\decisions-pending-batch-20260426.md` §カテゴリ 2 #14
- 前提 spec:
  - `docs/specs/2026-04-26-root-help-module.md`（ヘルプモジュール、`root_help_inquiries` 連携元）
  - `docs/specs/2026-04-25-root-phase-b-06-notification-platform.md`（B-6 通知基盤）

---

## 1. 目的とスコープ

### 1.1 目的

Garden 全モジュールから寄せられる「操作が分からない」「ヘルプ記事を直してほしい」「バグ報告」  
などを **一か所に集約し、東海林さん（super_admin）が業務の合間に順序よく消化できる**  
開発者専用インボックスを提供する。

確定ログ #14 で決まった集約フロー：

```
社員がヘルプから「分からない」「修正してほしい」を送信
   ↓ ① Chatwork 事務局ルームに通知（休日・離席時用、即時把握）
   ↓ ② Garden 内 開発者ページに「未消化リスト」として登録
   ↓
東海林さんが作業時、開発者ページの一覧で 1 件ずつ消化
```

### 1.2 フェーズ感（重要）

| フェーズ | 実装状態 | 運用方針 |
|---|---|---|
| **Phase A-B** | **実装しない** | Chatwork 通知のみで運用。東海林さんが Chatwork 経由で依頼を手動把握・消化 |
| **Phase C-D** | **本格実装着手** | 本 spec を起点に `/admin/dev-inbox` 実装。着手時に §13 工数を再見積 |

Phase A-B 中は本 spec は**設計確定・参照専用ドキュメント**として保持し、実装は行わない。  
Phase C 終盤〜Phase D 序盤での着手を想定する。

### 1.3 含める

- 未消化リスト（pending / reviewing / in_progress タブ切替）
- モジュール別・種別別・優先度・依頼者・日付範囲フィルタ
- 依頼詳細ページ（依頼内容・添付・コメント・ステータス更新）
- 消化アーカイブ（completed / rejected / wontfix）
- Postgres FTS 全文検索
- ヘルプ依頼（`root_help_inquiries`）との統合ビュー
- Chatwork 通知連携（B-6 通知基盤経由）
- 東海林さん専用 UX（ピン留め・バッジ・キーボードショートカット）
- 依頼者フィードバック（完了時の Chatwork DM 自動送信）

### 1.4 含めない

- Phase A-B 実装（Chatwork のみ運用）
- Sentry / PagerDuty 等の外部障害管理連携（§14 判断保留）
- AI 自動回答・優先度自動付与（将来拡張）
- 外部公開フォーム（内部専用）
- メール通知（B-6 Email 実装後に追加検討）

---

## 2. 既存実装との関係

### 2.1 Phase A-B 運用（現状）

Phase A-B では本画面は存在しない。Chatwork 運用で代替：

| 役割 | 代替手段 |
|---|---|
| 新規依頼の把握 | Chatwork 事務局ルームへの B-6 通知 |
| 依頼の管理 | 東海林さんが Chatwork メッセージを手動でトラッキング |
| 完了通知 | Chatwork DM で東海林さんが手動返信 |

### 2.2 ヘルプモジュール（Root Help spec）との関係

`docs/specs/2026-04-26-root-help-module.md` で定義された `root_help_inquiries` が  
本 spec の**統合ビューの一方の入力元**となる。

| ヘルプ spec テーブル | 連携方式 | 本 spec での扱い |
|---|---|---|
| `root_help_inquiries` | 統合ビュー `root_developer_inbox_unified` で UNION | help 由来の依頼として一覧に合流 |

ヘルプ spec の `submitHelpInquiry` Server Action は Phase D で  
**`submitInquiry` (本 spec §7) に統合するか、または二重登録する**方式を選択する（§14 判断保留）。

### 2.3 確定ログ #10（ヘルプ編集権限）との関係

確定ログ #10 により「ヘルプ記事は誰も直接編集しない、修正提案は開発者依頼ボタン経由」  
となった。本画面がその**集約先**として機能する。

```
ヘルプ記事閲覧者（manager / admin 含む）
   → 「この記事を修正依頼する」ボタン（開発者依頼ボタン）
   → root_developer_inbox_items に INSERT（item_type='help_change_request'）
   → 本画面に pending として登録
```

### 2.4 B-6 通知基盤との関係

Chatwork 送信はすべて B-6 (`root_notification_platform`) の `notify()` ヘルパー経由。  
本 spec 専用チャネルとして以下を `root_notification_channels` に登録する：

| チャネル識別子 | 用途 | 送信先 |
|---|---|---|
| `chatwork-jimukyoku` | 全依頼の新着通知 | 事務局ルーム（ID は §15 未確認事項）|
| `chatwork-shoji-dm` | urgent 依頼・作業開始通知 | 東海林さん個人 DM |

### 2.5 他モジュールとの連携ポイント（詳細は §9）

各モジュール内に「困ったときは」リンクを設置し、本画面の `submitInquiry` フォームへ遷移させる。  
a-tree / a-leaf / a-bud は Phase C-D 着手時に自モジュールのリンク設置を対応すること。

---

## 3. データモデル提案

### 3.1 `root_developer_inbox_items`（汎用問い合わせ・依頼）

```sql
CREATE TABLE root_developer_inbox_items (
  item_id        bigserial PRIMARY KEY,

  -- 依頼種別
  item_type      text NOT NULL CHECK (item_type IN (
    'help_change_request',   -- ヘルプ修正依頼（ヘルプ記事に紐付く）
    'general_question',      -- 操作問い合わせ（ヘルプに答えがない質問）
    'bug_report',            -- バグ報告
    'feature_request',       -- 機能追加要望
    'other'                  -- その他
  )),

  -- 参照元テーブル連携（help_change_request の場合は root_help_articles）
  source_table   text,        -- 'root_help_articles' 等
  source_id      bigint,      -- 参照元のレコード ID

  -- 依頼本体
  title          text NOT NULL,
  body_md        text,
  module         text,        -- 'tree' / 'soil' / 'leaf-kanden' / 'help' / 'bud' 等
  attachments    jsonb,       -- [{type, storage_path, name, size_bytes}]

  -- 優先度・ステータス
  priority       text NOT NULL DEFAULT 'normal' CHECK (priority IN (
    'low', 'normal', 'high', 'urgent'
  )),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- 新規、未着手
    'reviewing',    -- 確認中（東海林さんが内容チェック中）
    'in_progress',  -- 作業中（東海林さんが実際に対応中）
    'completed',    -- 完了
    'rejected',     -- 対応しない（理由あり）
    'wontfix'       -- 仕様として対応しない
  )),

  -- 担当者
  requested_by   uuid NOT NULL REFERENCES auth.users(id),
  assigned_to    uuid REFERENCES auth.users(id), -- 既定: super_admin（東海林さん）

  -- 作業タイムスタンプ
  started_at     timestamptz,   -- status='in_progress' 設定時に自動更新
  completed_at   timestamptz,   -- status='completed' / 'rejected' / 'wontfix' 設定時

  -- 完了時の解決内容
  resolution     text,          -- 対応サマリ（1-3 行テキスト）
  resolution_md  text,          -- 詳細解決内容（Markdown、依頼者通知に使用）

  -- 依頼者への通知履歴
  notified_at    timestamptz,   -- 完了通知送信日時（NULL = 未送信）

  -- Postgres 全文検索（日本語 tsvector）
  search_vector  tsvector GENERATED ALWAYS AS (
    to_tsvector('japanese',
      coalesce(title, '') || ' ' ||
      coalesce(body_md, '') || ' ' ||
      coalesce(resolution, '')
    )
  ) STORED,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 未消化リスト用インデックス（優先度・日付順ソート）
CREATE INDEX root_dev_inbox_pending_idx
  ON root_developer_inbox_items (status, priority, created_at DESC)
  WHERE status IN ('pending', 'reviewing', 'in_progress');

-- 担当者別・未完了フィルタ用
CREATE INDEX root_dev_inbox_assigned_idx
  ON root_developer_inbox_items (assigned_to, status)
  WHERE status NOT IN ('completed', 'rejected', 'wontfix');

-- 全文検索用 GIN インデックス
CREATE INDEX root_dev_inbox_search_idx
  ON root_developer_inbox_items USING GIN (search_vector);
```

### 3.2 `root_developer_inbox_comments`（依頼に紐付くコメント・進捗メモ）

```sql
CREATE TABLE root_developer_inbox_comments (
  comment_id   bigserial PRIMARY KEY,
  item_id      bigint NOT NULL
    REFERENCES root_developer_inbox_items(item_id) ON DELETE CASCADE,
  commented_by uuid NOT NULL REFERENCES auth.users(id),
  body_md      text NOT NULL,
  is_internal  boolean NOT NULL DEFAULT true,
    -- true  = 開発者向けメモ（東海林さんのみ閲覧）
    -- false = 依頼者にも見える（§15 未確認事項参照）
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX root_dev_inbox_comments_item_idx
  ON root_developer_inbox_comments (item_id, created_at ASC);
```

### 3.3 `root_developer_inbox_status_log`（ステータス遷移履歴）

```sql
CREATE TABLE root_developer_inbox_status_log (
  log_id       bigserial PRIMARY KEY,
  item_id      bigint NOT NULL
    REFERENCES root_developer_inbox_items(item_id) ON DELETE CASCADE,
  changed_by   uuid NOT NULL REFERENCES auth.users(id),
  from_status  text NOT NULL,
  to_status    text NOT NULL,
  note         text,            -- 変更理由メモ（任意）
  changed_at   timestamptz NOT NULL DEFAULT now()
);

-- INSERT は Trigger のみ許可（手動 INSERT 禁止）
CREATE INDEX root_dev_inbox_status_log_item_idx
  ON root_developer_inbox_status_log (item_id, changed_at DESC);
```

ステータス変更 Trigger（概要）：

```sql
CREATE OR REPLACE FUNCTION root_dev_inbox_log_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO root_developer_inbox_status_log
      (item_id, changed_by, from_status, to_status)
    VALUES
      (NEW.item_id, auth.uid(), OLD.status, NEW.status);
    -- started_at / completed_at の自動設定
    IF NEW.status = 'in_progress' AND OLD.started_at IS NULL THEN
      NEW.started_at := now();
    END IF;
    IF NEW.status IN ('completed', 'rejected', 'wontfix') THEN
      NEW.completed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER root_dev_inbox_status_trigger
  BEFORE UPDATE ON root_developer_inbox_items
  FOR EACH ROW EXECUTE FUNCTION root_dev_inbox_log_status_change();
```

### 3.4 ヘルプ問い合わせとの統合ビュー

`root_help_inquiries`（ヘルプ spec 定義）と `root_developer_inbox_items` を  
統合して一覧表示するビュー。

```sql
CREATE OR REPLACE VIEW root_developer_inbox_unified AS

-- 本テーブル（汎用依頼）
SELECT
  item_id,
  item_type,
  title,
  body_md,
  module,
  priority,
  status,
  requested_by,
  assigned_to,
  created_at,
  updated_at,
  completed_at,
  'inbox' AS table_source,
  NULL::bigint AS help_inquiry_id
FROM root_developer_inbox_items

UNION ALL

-- ヘルプ問い合わせ（root_help_inquiries）をマッピング
SELECT
  -- item_id は負値でヘルプ側と衝突しないよう符号変換
  -- NOTE: Phase D 実装時に連番衝突を避ける方式を再検討（§14 判断保留）
  (-inquiry_id)       AS item_id,
  CASE category
    WHEN 'article_edit' THEN 'help_change_request'
    WHEN 'bug'          THEN 'bug_report'
    ELSE 'general_question'
  END                 AS item_type,
  subject             AS title,
  body                AS body_md,
  module,
  'normal'            AS priority,   -- ヘルプ側に priority 列なし
  CASE status
    WHEN 'pending'     THEN 'pending'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'responded'   THEN 'completed'
    WHEN 'closed'      THEN 'completed'
    ELSE 'pending'
  END                 AS status,
  inquired_by         AS requested_by,
  NULL::uuid          AS assigned_to,
  inquired_at         AS created_at,
  updated_at,
  NULL::timestamptz   AS completed_at,
  'help_request'      AS table_source,
  inquiry_id          AS help_inquiry_id
FROM root_help_inquiries;
```

---

## 4. データフロー

```mermaid
flowchart TB
    subgraph 依頼登録ルート
        A1[ヘルプ記事「修正依頼」ボタン] --> B1[submitInquiry\nitem_type=help_change_request]
        A2[各モジュール「困ったときは」リンク] --> B2[submitInquiry\ngeneral_question / bug_report 等]
        A3[root_help_inquiries INSERT\nヘルプお問い合わせフォーム] --> B3[統合ビューで自動合流]
    end

    B1 --> C[root_developer_inbox_items INSERT]
    B2 --> C
    C --> D[notify: chatwork-jimukyoku 通知]
    C --> E{priority = urgent?}
    E -->|Yes| F[notify: chatwork-shoji-dm 即時 DM]
    E -->|No| G[通常キュー]

    subgraph 東海林さん消化フロー
        H[/admin/dev-inbox を開く] --> I[未消化リスト確認\npending タブ]
        I --> J[1 件選択 → 詳細ページ]
        J --> K[status = reviewing に更新]
        K --> L[調査・対応]
        L --> M[status = in_progress]
        M --> N[notify: chatwork-shoji-dm 作業開始]
        N --> O[作業完了]
        O --> P[resolution 入力\nstatus = completed]
        P --> Q[notifyRequester 実行]
        Q --> R[依頼者へ Chatwork DM 完了通知]
    end

    B3 --> I
    G --> I
```

### 4.1 ステータス遷移図

```
pending
  ├── reviewing     （確認中）
  │     ├── in_progress  （作業中）
  │     │     ├── completed   ✅
  │     │     ├── rejected    ❌
  │     │     └── wontfix     🚫
  │     ├── rejected
  │     └── wontfix
  ├── in_progress   （確認スキップで直接着手）
  └── rejected      （内容不明・重複等で即却下）
```

---

## 5. ルーティング設計

```
/admin/dev-inbox                        未消化リスト（pending タブ既定）
/admin/dev-inbox?status=reviewing       確認中タブ
/admin/dev-inbox?status=in_progress     作業中タブ
/admin/dev-inbox?status=completed       完了アーカイブ
/admin/dev-inbox?status=rejected        却下アーカイブ
/admin/dev-inbox/[item_id]              依頼詳細ページ
/admin/dev-inbox/search?q=...           全文検索結果
```

Next.js App Router ディレクトリ構造：

```
src/app/(admin)/admin/dev-inbox/
├── page.tsx                    ← 未消化リスト
├── [item_id]/
│   └── page.tsx                ← 詳細ページ
└── search/
    └── page.tsx                ← 全文検索結果
```

アクセス制御（ミドルウェア / layout.tsx レベルで適用）：

| ロール | /admin/dev-inbox | /admin/dev-inbox/[item_id] |
|---|---|---|
| super_admin | フル閲覧・編集 | フル閲覧・編集 |
| admin | 全件閲覧（更新は不可） | 閲覧・コメント追加 |
| manager | 自分が requested_by の件のみ | 自分の依頼のみ閲覧 |
| staff / toss / closer / cs | 閲覧不可 | 自分の依頼のみ閲覧 |

---

## 6. UI 設計（ASCII ワイヤーフレーム）

### 6.1 未消化リスト（`/admin/dev-inbox`）

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  🔧 開発者インボックス                   [新規依頼を作成]  未消化 12件 🔴     │
│                                                                                │
│  ┌── タブ ───────────────────────────────────────────────────────────────┐   │
│  │ [● pending 8] [○ reviewing 2] [○ in_progress 2] [○ 完了済] [○ 却下]  │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
│  ┌── フィルタ ─────────────────────────────────────────────────────────┐     │
│  │ モジュール: [全て ▼]  種別: [全て ▼]  優先度: [全て ▼]             │     │
│  │ 依頼者: [全て ▼]      期間: [__ / __ 〜 __ / __]  [🔍 検索]        │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │ 📌 [urgent] Tree > bug_report                              2026-04-26 │    │
│  │    架電アプリで発信ボタンが2回押せる                         鈴木 花子  │    │
│  ├──────────────────────────────────────────────────────────────────────┤    │
│  │ [high]  Help > help_change_request                         2026-04-25 │    │
│  │    ログイン手順記事の手順3が古い                            山田 太郎  │    │
│  ├──────────────────────────────────────────────────────────────────────┤    │
│  │ [normal] Bud > general_question                            2026-04-25 │    │
│  │    振込ファイルの生成後にダウンロードできない                佐藤 次郎  │    │
│  ├──────────────────────────────────────────────────────────────────────┤    │
│  │ [normal] Leaf > general_question                           2026-04-24 │    │
│  │    関電申込入力の項目の意味が分からない（工事希望日）        田中 美穂  │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                                │
│  [← 前へ]  1 / 2  [次へ →]   「次の1件」→                                  │
└────────────────────────────────────────────────────────────────────────────────┘
```

ナビバッジ: 未消化件数（pending + reviewing + in_progress の合計）を  
`/admin/dev-inbox` のサイドバーメニューに数値バッジ表示。  
24 時間超過の依頼がある場合はバッジを警告色（赤系）に変更。

### 6.2 依頼詳細ページ（`/admin/dev-inbox/[item_id]`）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← 一覧へ戻る                                          「次の1件」→       │
│  [urgent] 🔴 Tree > bug_report                            依頼 #142      │
│  架電アプリで発信ボタンが2回押せる                                          │
│  依頼者: 鈴木 花子   登録: 2026-04-26 14:32   経過: 2時間                  │
│  ─────────────────────────────────────────────────────────────────────     │
│  ── 依頼内容 ─────────────────────────────────────────────────────────    │
│  架電アプリの発信ボタンを素早く2回クリックすると2件の                       │
│  コール履歴が作成される。（再現手順省略）                                   │
│  📎 screenshot-tree-double-click.png                                       │
│  ── 関連記事（help_change_request のみ表示）─────────────────────────     │
│  （なし）                                                                   │
│  ── コメント ─────────────────────────────────────────────────────────    │
│  [東海林] 14:50  [🔒 内部]  発信ボタンの debounce 未実装。D-1 で修正予定  │
│  [コメント追加]  ○ 内部メモ  ○ 依頼者にも見える   [テキスト欄] [追加]     │
│  ── ステータス変更 ───────────────────────────────────────────────────    │
│  現在: pending   [reviewing] [🚀 in_progress]                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 完了モーダル（ステータス = completed 設定時）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  依頼 #142 を完了にする                                                    │
│  解決内容（依頼者通知に使用）:                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 発信ボタンの連打防止（debounce）を実装しました。                     │  │
│  │ Tree Phase D-1 リリース後にご確認ください。                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  依頼者への通知プレビュー:  【Garden 対応完了】... ▼ 対応内容 ...          │
│  通知方法: ● Chatwork DM を送信  ○ 通知しない                             │
│  [✅ 完了にして通知を送る]    [キャンセル]                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. API / Server Action 契約

`src/app/(admin)/admin/dev-inbox/actions/inbox.ts`

```typescript
// 誰でも呼び出し可
submitInquiry(params: {
  title: string; body_md?: string;
  item_type: 'help_change_request'|'general_question'|'bug_report'|'feature_request'|'other';
  module?: string; priority?: 'low'|'normal'|'high'|'urgent';
  attachments?: Array<{ type: string; storage_path: string; name: string }>;
  source_table?: string; source_id?: number;   // ヘルプ記事修正依頼の場合
}): Promise<{ item_id: number; message: string }>

// admin+ は全件、manager 以下は requested_by 本人の依頼のみ
getInboxList(params: {
  status?: string | string[];   // 未指定 = pending,reviewing,in_progress
  module?: string; item_type?: string; priority?: string;
  requested_by?: string; date_from?: string; date_to?: string;
  page?: number; per_page?: number;  // 既定: 20
}): Promise<{ items: InboxItem[]; total: number; unread_urgent: number }>

// admin+ または requested_by 本人
getInboxItem(item_id: number)
  : Promise<{ item: InboxItem; comments: InboxComment[]; status_log: InboxStatusLog[] } | null>

// assigned_to または super_admin のみ
updateInboxStatus(params: {
  item_id: number;
  status: 'reviewing'|'in_progress'|'completed'|'rejected'|'wontfix';
  resolution?: string; resolution_md?: string; note?: string;
}): Promise<{ updated: boolean; notified?: boolean }>

// admin+ または requested_by
addInboxComment(params: {
  item_id: number; body_md: string;
  is_internal?: boolean;  // 既定: true（内部メモ）
}): Promise<{ comment_id: number }>

// 完了時に updateInboxStatus から自動呼び出し、または手動呼び出し可
notifyRequester(params: { item_id: number })
  : Promise<{ sent: boolean; chatwork_message_id?: string }>

// Postgres FTS
searchInbox(params: { q: string; status?: string[]; module?: string; limit?: number })
  : Promise<{ results: InboxSearchResult[]; total: number }>
```

---

## 8. RLS

```sql
-- ────────────────────────────────────────
-- root_developer_inbox_items
-- ────────────────────────────────────────
ALTER TABLE root_developer_inbox_items ENABLE ROW LEVEL SECURITY;

-- SELECT: admin+ は全件、それ以外は自分が requested_by のもののみ
CREATE POLICY dev_inbox_select ON root_developer_inbox_items
  FOR SELECT USING (
    has_permission_v2(auth.uid(), 'root', 'admin')
    OR requested_by = auth.uid()
  );

-- INSERT: 認証ユーザー全員可（依頼送信）
CREATE POLICY dev_inbox_insert ON root_developer_inbox_items
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND requested_by = auth.uid()
  );

-- UPDATE: admin+（ステータス更新・解決内容入力）
CREATE POLICY dev_inbox_update ON root_developer_inbox_items
  FOR UPDATE USING (
    has_permission_v2(auth.uid(), 'root', 'admin')
  );

-- DELETE: 禁止（論理削除として rejected / wontfix を使用）
-- （.claude/settings.json の deny ルールでシステム的にも防護）

-- ────────────────────────────────────────
-- root_developer_inbox_comments
-- ────────────────────────────────────────
ALTER TABLE root_developer_inbox_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: item の閲覧権限に従う + is_internal=false は requested_by も閲覧可
CREATE POLICY dev_inbox_comments_select ON root_developer_inbox_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM root_developer_inbox_items i
      WHERE i.item_id = root_developer_inbox_comments.item_id
        AND (
          has_permission_v2(auth.uid(), 'root', 'admin')
          OR (i.requested_by = auth.uid() AND NOT is_internal)
        )
    )
  );

-- INSERT: admin+ または requested_by 本人
CREATE POLICY dev_inbox_comments_insert ON root_developer_inbox_comments
  FOR INSERT WITH CHECK (
    has_permission_v2(auth.uid(), 'root', 'admin')
    OR EXISTS (
      SELECT 1 FROM root_developer_inbox_items i
      WHERE i.item_id = root_developer_inbox_comments.item_id
        AND i.requested_by = auth.uid()
    )
  );

-- ────────────────────────────────────────
-- root_developer_inbox_status_log
-- ────────────────────────────────────────
ALTER TABLE root_developer_inbox_status_log ENABLE ROW LEVEL SECURITY;

-- SELECT: admin+ のみ
CREATE POLICY dev_inbox_log_select ON root_developer_inbox_status_log
  FOR SELECT USING (
    has_permission_v2(auth.uid(), 'root', 'admin')
  );

-- INSERT: Trigger のみ（手動 INSERT は service role 以外禁止）
CREATE POLICY dev_inbox_log_insert ON root_developer_inbox_status_log
  FOR INSERT WITH CHECK (false);
  -- Trigger は SECURITY DEFINER で service role として動作
```

---

## 9. 他モジュールとの連携ポイント

各モジュールは Phase C-D 着手時に以下を実装する。

| モジュール | 対応内容 | 初期値 |
|---|---|---|
| **a-tree** | ヘッダー / サイドバーに「困ったときは」リンク設置 | `module=tree`, `item_type=general_question` |
| **a-leaf** | 関電申込画面に「入力項目が分からない場合」リンク設置 | `module=leaf-kanden`, `item_type=general_question` |
| **a-bud** | 振込・給与計算画面に「操作不明ボタン」設置 | `module=bud`, `item_type=general_question` |
| **a-bloom** | ダッシュボードに未消化件数・最近完了件数ウィジェット（admin+ のみ） | クリックで `/admin/dev-inbox` 遷移 |

リンク先は `/admin/dev-inbox/new?module=<module>&item_type=<type>` またはポップアップフォームで  
`submitInquiry` を呼び出す方式とする。

---

## 10. Chatwork 連携詳細

B-6 通知基盤（`notify()` ヘルパー）を経由して送信。  
チャネル ID は §15 未確認事項として保留中。

### 10.1 通知トリガーと送信先

| タイミング | 送信先 | template_key | 備考 |
|---|---|---|---|
| 新規 INSERT（全依頼） | `chatwork-jimukyoku` | `dev_inbox_new` | 優先度・種別付きで送信 |
| 優先度 = urgent の新規 INSERT | `chatwork-shoji-dm` | `dev_inbox_urgent` | 即時 DM 転送 |
| status = `in_progress` に変更 | `chatwork-shoji-dm` | `dev_inbox_started` | 作業開始通知 |
| status = `completed` | 依頼者 Chatwork DM | `dev_inbox_completed` | resolution_md 抜粋付き |
| pending 24h 超過 | `chatwork-shoji-dm` | `dev_inbox_overdue` | Vercel Cron 日次バッチ（Root Phase A-3c）|

### 10.2 通知テンプレート（template_key / 送信内容概要）

| template_key | 送信内容 |
|---|---|
| `dev_inbox_new` | 「新規依頼 #{{item_id}} / 優先度・種別・モジュール・件名・依頼者 / 確認URL」 |
| `dev_inbox_urgent` | 「🔴 緊急依頼 #{{item_id}} - {{module}} / {{title}} / 今すぐ確認URL」 |
| `dev_inbox_started` | 「東海林さんが依頼 #{{item_id}} の対応を開始しました」 |
| `dev_inbox_completed` | 「【Garden 対応完了】{{title}} / ▼ 対応内容 {{resolution_md}} / ご不明点は再依頼を」|
| `dev_inbox_overdue` | 「24h 超未消化の依頼一覧 / 件数・直近依頼リンク」 |

---

## 11. UX 設計（東海林さん専任の消化体験）

### 11.1 ナビバッジ

- サイドバーの「開発者用 > 開発者インボックス」に未消化件数をバッジ表示
- 件数 = `pending + reviewing + in_progress` の合計
- 24 時間超過の pending が 1 件以上 → バッジを警告色（赤系 `text-red-600`）に変更

### 11.2 ピン留め（東海林さん専任依頼の優先表示）

- `assigned_to = 東海林さんの uuid` のレコードを一覧最上位に表示
- `priority = urgent` のものは 📌 マーカーと背景色（黄系）で強調

### 11.3 作業中マーク（重複対応防止）

- `status = 'in_progress'` の依頼に「東海林さん作業中 🔧」ラベルを表示
- 一覧・詳細両方に表示し、誤った重複対応を防止

### 11.4 キーボードショートカット

| キー | 動作 |
|---|---|
| `j` / `↓` | 次の依頼へ移動 |
| `k` / `↑` | 前の依頼へ移動 |
| `Enter` | 選択中の依頼を詳細ページで開く |
| `c` | コメント入力欄へフォーカス |
| `s` | ステータス変更ドロップダウンを開く |
| `n` | 「次の 1 件」へ遷移（消化フロー）|
| `Esc` | 詳細から一覧へ戻る |

### 11.5 一括処理

- 一覧でチェックボックス複数選択 → 「一括でステータス変更」
- 対象: pending → reviewing の一括昇格、または rejected への一括却下
- 一括 completed は意図しない完了処理を防ぐため**禁止**

### 11.6 「次の 1 件」ボタン

- 詳細ページのヘッダーに「次の 1 件 →」ボタンを常時表示
- pending / reviewing のうち priority 降順・created_at 昇順の次の依頼へ遷移
- 全件消化後は「未消化はありません」トースト表示

---

## 12. 受入基準

1. ✅ 全モジュール（Tree / Leaf / Bud 等）から `submitInquiry` を呼び出すと  
   `root_developer_inbox_items` に `pending` として登録される
2. ✅ 新規登録時に `chatwork-jimukyoku` へ通知が届く
3. ✅ urgent 登録時に `chatwork-shoji-dm` へ即時 DM が届く
4. ✅ super_admin / admin が `/admin/dev-inbox` で一覧を閲覧できる
5. ✅ タブ切替（pending / reviewing / in_progress）が動作する
6. ✅ モジュール別・種別別・優先度・依頼者・日付範囲のフィルタが動作する
7. ✅ 詳細ページでコメント追加・ステータス更新ができる
8. ✅ ステータス変更が `root_developer_inbox_status_log` に記録される
9. ✅ `completed` 設定時に依頼者へ Chatwork DM が送信される
10. ✅ `/admin/dev-inbox/search?q=` で件名・本文の全文検索が動作する
11. ✅ `root_developer_inbox_unified` ビューで `root_help_inquiries` が一覧に合流する
12. ✅ manager は自分の依頼のみ閲覧できる（他人の依頼は404）
13. ✅ ナビバッジに未消化件数が表示され、24h 超過で警告色になる
14. ✅ キーボードショートカット `j/k/Enter/n` が動作する

---

## 13. 想定工数（内訳、0.25d 刻み）

| # | 作業 | 工数 |
|---|---|---|
| W1 | `root_developer_inbox_items` + `_comments` + `_status_log` + index + RLS + view + tsvector GIN migration、status Trigger | 0.25d |
| W2 | `submitInquiry` Server Action + 統合ビュー `root_developer_inbox_unified` + 一覧ページ（タブ・フィルタ・ページネーション） | 0.5d |
| W3 | ステータス更新 + コメント追加 + 依頼者通知 Server Action（`updateInboxStatus` / `addInboxComment` / `notifyRequester`）| 0.25d |
| W4 | 詳細ページ UI（依頼内容・関連記事リンク・コメント欄・ステータス更新ボタン・完了モーダル）| 0.5d |
| W5 | Chatwork 通知連携（B-6 通知基盤利用、4テンプレート・urgent 即時 DM・overdue Cron）| 0.25d |
| W6 | 全文検索ページ（Postgres FTS、`searchInbox` + `/admin/dev-inbox/search` UI）| 0.25d |
| W7 | ナビバッジ・キーボードショートカット・一括処理・「次の 1 件」ボタン・Bloom ウィジェット | 0.25d |
| **合計** | | **2.25d** |

※ Phase C-D 着手時に工数を再見積する。B-6 通知基盤が未完了の場合は W5 が増加する可能性あり。

---

## 14. 判断保留

| # | 論点 | 現状スタンス |
|---|---|---|
| 判1 | urgent 優先度の自動エスカレーション閾値（pending 24h 超で urgent 化等） | 現状は手動 urgent 設定のみ。自動化は Phase C-D 実装時に再検討 |
| 判2 | resolution_md のテンプレート提供（完了モーダルに定型文候補を表示するか） | 空のテキストエリアで実装し、よく使う文言は Phase D 以降に追加 |
| 判3 | 完了通知の送信タイミング（即時 vs 翌営業日まとめ） | 即時送信（updateInboxStatus 完了と同時）で実装 |
| 判4 | SLA 表示（依頼者向けに「平均消化時間 X 日」等） | Phase D 以降で追加検討、初期実装では対象外 |
| 判5 | 削除・アーカイブポリシー（完了から N 日後に物理削除など） | 論理削除のみ（rejected / wontfix ステータス）、物理削除は行わない方針。長期保存ポリシーは Phase D 時に確認 |
| 判6 | assigned_to の自動割当ロジック（東海林さん固定 vs モジュール別担当者） | 当面は東海林さん（super_admin）固定。将来的にモジュール別担当者設定も可能な構造にする |
| 判7 | bug_report の外部障害管理（Sentry 等）との統合可否 | 当面は Garden 内のみで管理。Sentry 連携は Phase D 以降に判断 |
| 判8 | `root_help_inquiries` と `submitInquiry` の統合方式 | 統合ビューで並列表示（現状案）vs submitInquiry に一本化（2 テーブル廃止）を Phase D 着手時に判断 |
| 判9 | Bud 金額関連 bug の priority='urgent' 自動設定 | 自動設定は意図しない urgent 乱発リスクあり。依頼者が手動選択する UI で対応 |
| 判10 | `root_developer_inbox_unified` ビューの item_id 負値符号変換 | 短期実装としては有効だが、Phase D 本格実装時に採番方式を統一検討 |

---

## 15. 未確認事項（東海林さん要ヒアリング）

| # | 未確認事項 | 影響箇所 |
|---|---|---|
| U1 | 通知先 Chatwork ルームの正式 ID（事務局ルーム / 東海林さん個人 DM）| §10 通知テンプレート、B-6 通知基盤の購読設定 |
| U2 | `is_internal=false` コメントの公開ルール（依頼者本人はどこで確認するか）| §3.2、§6.2、§8 RLS |
| U3 | urgent 優先度の運用方針（誰が設定するか、どんな基準か） | §3.1 priority フィールド、§10.1 通知 |
| U4 | 依頼者が「やっぱり不要」と言った場合の取扱い（取り下げボタンを設けるか） | §3.1 ステータス、§5 ルーティング |
| U5 | 一般問い合わせ（general_question）と help spec の `root_help_inquiries` を将来的に1テーブルに統合するか（§14 判8 と連動）| §3.4 統合ビュー |

---

— end of Root Dev-Inbox spec —
