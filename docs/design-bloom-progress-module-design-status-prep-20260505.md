# Bloom 進捗ページ モジュールタブ「設計状況」実データ化 準備設計 - 2026-05-05

> 起草: a-main-012
> 用途: /bloom/progress モジュールタブ内「設計状況」セクション に実データを乗せる準備（5/9 以降 dispatch 投下用）
> ステータス: 草案（dispatch 起草前の内部設計）
> 起草時刻: 2026-05-05(火) 21:08

---

## 1. 背景

東海林さん指示:
「Garden 開発進捗のモジュールタブ内の設計状況に実データを乗せていく準備をしたい。各セッションに現在構築しているものを取りまとめてもらうのはどう？」

現状:
- /bloom/progress モジュールタブには 12 module 各カードに「設計状況」セクション（v29 アコーディオン）あり
- 試作版は静的サンプル
- root_module_progress テーブルの summary 列だけでは設計状況の構造化表現に不足

目標:
- 各セッションが現状を整理 → Drive 経由で取りまとめ → Root に蓄積 → Bloom 進捗ページで動的表示

---

## 2. 対象モジュール（7 module、Forest / Bud 除外）

| Module | セッション | 取りまとめ依頼 |
|---|---|---|
| Bloom | a-bloom-003 | ✅ |
| Tree | a-tree | ✅ |
| Leaf | a-leaf | ✅ |
| Root | a-root-002 | ✅ |
| Soil | a-soil | ✅ |
| Sprout | a-sprout | ✅ |
| Calendar | a-calendar | ✅ |
| **Forest** | a-forest | ❌ 除外（決算作業集中、5/6-5/16）|
| **Bud** | （a-forest 兼任）| ❌ 除外（Forest から派生、a-forest が同時に Bud 引き継ぎ資料作成）|
| Rill / Seed / Fruit | — | ❌ 除外（未着手、プレースホルダーのみ）|

---

## 3. データモデル設計

### 3-1. 既存テーブル拡張 vs 新規テーブル

採用案: **新規テーブル `root_module_design_status`**

理由:
- v29 アコーディオン構造（section 単位の項目群）と整合
- root_module_progress.summary 拡張だと 1 列に大量テキストとなり検索・更新コスト大
- section 単位で表示順制御 / フィルタ可能

### 3-2. `root_module_design_status` schema

```sql
CREATE TABLE root_module_design_status (
  id BIGSERIAL PRIMARY KEY,
  module TEXT NOT NULL REFERENCES root_module_progress(module),
  section TEXT NOT NULL CHECK (section IN (
    'phase',          -- 開発フェーズ（A/B/C/D + 状態）
    'completed',      -- 完成済機能（主要）
    'in_progress',    -- 進行中（直近）
    'pending',        -- 残課題
    'spec_links',     -- 主要 spec / 設計書 path
    'session'         -- 担当セッション
  )),
  content TEXT NOT NULL,
  ord INT DEFAULT 0,
  source TEXT DEFAULT 'session-handoff',  -- 取りまとめ由来
  reported_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_root_module_design_status_module ON root_module_design_status(module);
CREATE INDEX idx_root_module_design_status_section ON root_module_design_status(section);

CREATE TRIGGER trg_root_module_design_status_updated_at
  BEFORE UPDATE ON root_module_design_status
  FOR EACH ROW EXECUTE FUNCTION root_update_updated_at();

ALTER TABLE root_module_design_status ENABLE ROW LEVEL SECURITY;
-- RLS: admin / super_admin SELECT、service_role bypass（既存 root_kot_sync_log パターン踏襲）
```

### 3-3. データ例

```
module='Bloom', section='phase', content='Phase B 進行中、本番運用近い'
module='Bloom', section='completed', content='Workboard / 日報 / 月次まとめ / 経営状況 / 開発進捗 (β) 6 画面実装完了'
module='Bloom', section='completed', content='独自認証（bloom_users）+ ロール設計'
module='Bloom', section='in_progress', content='/bloom/progress 実データ化（API ルート + Server Component）'
module='Bloom', section='pending', content='完全 React 化（v29 HTML 9221 行移植）'
module='Bloom', section='spec_links', content='docs/superpowers/specs/2026-04-21-shinkouki-auto-update-design.md'
module='Bloom', section='session', content='a-bloom-003'
```

### 3-4. v29 アコーディオン表示構造（参考）

v29 HTML 内モジュールカード（gpd-module-card）:
```html
<div class="ceo-card gpd-module-card">
  <div class="gpd-mc-head">
    <span class="gpd-mc-orb"><img src="..." /></span>
    <div class="gpd-mc-name-block">
      <div class="gpd-mc-jp">Bloom</div>
      <div class="gpd-mc-en">グループ全体の動きと業績を見える化</div>
    </div>
    <span class="gpd-mc-pct">65%</span>
    <span class="gpd-mc-toggle">▾</span>
  </div>
  <div class="gpd-mc-body">
    <div class="gpd-mc-section">
      <h5 class="gpd-mc-h">全体進捗</h5>
      <div class="gs-progress">...</div>
    </div>
    <div class="gpd-mc-section">
      <h5 class="gpd-mc-h">関連 Phase</h5>
      <div class="gpd-mc-pills">...</div>
    </div>
    <!-- 設計状況アコーディオン -->
    <div class="gpd-mc-accordion gpd-acc-open">
      <h5 class="gpd-mc-h">設計状況</h5>
      <ul>
        <li>完成済機能: ...</li>
        <li>進行中: ...</li>
        <li>残課題: ...</li>
      </ul>
    </div>
  </div>
</div>
```

→ section ごとに `<ul>` + `<li>` で表示。content 列を行単位で挿入。

---

## 4. 取りまとめフォーマット（各セッション向け）

### 4-1. 配置場所

各セッションが `_chat_workspace/garden-design-status/<module>.md` として起草:

```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-design-status\
├── bloom.md
├── tree.md
├── leaf.md
├── root.md
├── soil.md
├── sprout.md
└── calendar.md
```

### 4-2. テンプレ

```markdown
# Garden <Module> 設計状況（YYYY-MM-DD 時点）

## 開発フェーズ
- 全体進捗: NN%
- 関連 Phase: A / B / C / D
- 状態: 未着手 / 設計中 / 実装中 / α運用 / β運用 / 本番運用

## 完成済機能（主要、3-5 件）
- 機能 A
- 機能 B
- 機能 C

## 進行中（直近、1-3 件）
- 作業 X（着手日: YYYY-MM-DD / 完了見込み: YYYY-MM-DD）
- 作業 Y

## 残課題（主要、3-5 件）
- 課題 1
- 課題 2

## 主要 spec / 設計書（path）
- docs/superpowers/specs/xxx.md
- docs/superpowers/specs/yyy.md

## 担当セッション
a-<module> / a-<module>-NNN

## 更新ルール
- 月次更新（前月分実績 + 当月予定）推奨
- 進捗 % 大幅変動時 + Phase 切替時 即更新
```

### 4-3. 後続フロー

1. 各セッションが上記テンプレで起草、`_chat_workspace/garden-design-status/<module>.md` 保存
2. a-root-002（or 別セッション）が読み取り → パース → root_module_design_status に upsert
3. /api/bloom/progress-html が fetch → HTML 生成 → 表示

---

## 5. dispatch テンプレ（5/9 以降投下用、7 セッション同等）

### 5-1. 共通テンプレ

```
🟢 main- No. NN
【a-main-NNN から a-<module> への dispatch（設計状況 取りまとめ依頼）】
発信日時: YYYY-MM-DD(曜) HH:MM

Garden 開発進捗ページ（/bloom/progress）モジュールタブの「設計状況」セクションを実データ化するため、a-<module> セッションに現状の取りまとめをお願いします。

【依頼内容】

`_chat_workspace\garden-design-status\<module>.md` として下記テンプレで起草してください:

[テンプレ全文（4-2 から流用）]

【完了報告フォーマット】

<module>-NN で:
- _chat_workspace 内 path 確認
- 5 セクション（phase / completed / in_progress / pending / spec_links）の記入完了確認
- 完了時刻

【dispatch counter】

a-main-NNN: 次 main- No. NN+1
a-<module>: <module>-NN で完了報告予定

工数見込み: 30〜45 分（現状把握 + テンプレ記入）

ご対応お願いします。
```

### 5-2. 7 セッション宛先

| dispatch | 宛先 | 期待 module 名 |
|---|---|---|
| main- No. NN | a-bloom-003 | bloom |
| main- No. NN+1 | a-tree | tree |
| main- No. NN+2 | a-leaf | leaf |
| main- No. NN+3 | a-root-002 | root |
| main- No. NN+4 | a-soil | soil |
| main- No. NN+5 | a-sprout | sprout |
| main- No. NN+6 | a-calendar | calendar |

→ NN は 5/9 時点の dispatch counter から連番採番。

---

## 6. 実装スケジュール（5/9 以降）

| 時期 | 作業 | 担当 |
|---|---|---|
| 5/9 朝 | 7 セッション dispatch 投下 | a-main-NNN |
| 5/9-5/12 | 各セッション取りまとめ（30-45 分 × 7）| 各セッション |
| 5/12-5/13 | a-root-002 が migration + import script 作成 | a-root-002 |
| 5/13 夕 | 取りまとめ済 7 セッション分を Root に upsert | a-root-002 |
| 5/14 | a-bloom-003 が /api/bloom/progress-html を拡張（design_status fetch 追加）| a-bloom-003 |
| 5/15 | Chrome MCP 視覚検証 | a-main-NNN |

→ 5/15 までに完成、5/22 のデモ（あれば）で実データ表示可能。

---

## 7. 関連 docs / memory

- `docs/dispatch-main-no60-bloom-003-progress-real-data-server-side-20260505.md`（API ルート方式）
- `docs/design-phase-2-data-sync-state-to-root-20260505.md`（Phase 2 自動 sync）
- `project_garden_3layer_visual_model.md`
- `feedback_dispatch_header_format.md`

---

## 8. 改訂履歴

- 2026-05-05 21:08 初版（a-main-012、東海林さん指示「モジュールタブ設計状況に実データ」採用、7 module 対象）
