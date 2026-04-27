# Bloom-002 後追い dispatch v5 - デザイン改善 8 件 + 権限別ルーティング - 2026-04-27

> 起草: a-main 008
> 用途: ChatGPT デザイン参考画像 (4/27 14:33-14:41 生成) を反映した Bloom-002 後追い実装
> 戦略: 5/5 後道さんデモ前にデザイン洗練 + 権限別ルーティング基盤 8 件統合
> 前提: Phase 2-2 候補 6 (Pattern B カルーセル) 完了済 + 候補 7 hover scale 強化（v4、未投下）

## 1. dispatch 投下用短文（コピペ）

```
【a-main-008 から Bloom-002 へ】Phase 2-2 候補 8 着手 (デザイン改善 + 権限別ルーティング 8 件統合)

▼ 戦略
ChatGPT デザイン参考画像 v1（4/27 生成）を Bloom-002 実装に反映。5/5 後道さんデモまでに洗練度を上げる。
参考画像（読込必須）:
- _shared/attachments/20260427/ai-images/design-references/home-design-reference-v1.png（ホーム画面デザイン参考）
- _shared/attachments/20260427/ai-images/design-references/login-design-reference-v1.png（ログイン画面デザイン参考）
- _shared/attachments/20260427/ai-images/garden-logo.png + .webp（左上ロゴ用クリスタル大樹）

▼ 8 件の改善内容

1. 左上ロゴ差し替え（簡素葉アイコン → クリスタル大樹）
   - 配置: public/themes/garden-logo.webp（_shared/attachments/.../garden-logo.webp から複製）
   - サイズ: 40-48px（ヘッダー左端）
   - 既存「Garden Series」テキストロゴと併存、アイコンのみ差替
   - 無効サイズで pixelize しないよう、SVG 化検討（後追い OK、初版は WebP）

2. 12 モジュールアイコン並び順 → CLAUDE.md 公式 1-12 順
   - 1 行目: Soil / Root / Tree / Leaf
   - 2 行目: Bud / Bloom / Seed / Forest
   - 3 行目: Rill / Fruit / Sprout / Calendar
   - 既存 ModuleSlot の coordinate / data-module-key を維持しつつ、配列 order のみ変更
   - 4 カテゴリ → 3 レイヤー（候補 7）の Y 座標体系を尊重

3. アイコンラベル → 英語名 + 役割サブ説明
   - 上段（太字、英語）: "Soil" / "Root" / "Tree" / "Leaf" / "Bud" / "Bloom" / "Seed" / "Forest" / "Rill" / "Fruit" / "Sprout" / "Calendar"
   - 下段（控えめサイズ、日本語 13 文字程度）:
     - Soil: DB 本体・大量データ基盤
     - Root: 組織・マスタデータ
     - Tree: 架電アプリ
     - Leaf: 個別アプリ・トスアップ
     - Bud: 経理・収支
     - Bloom: 案件一覧・KPI
     - Seed: 新事業
     - Forest: 全法人決算
     - Rill: Chatwork 連携
     - Fruit: 法人実体（番号系・許認可）
     - Sprout: 新商材オンボーディング
     - Calendar: 時間軸・スケジュール

4. 挨拶テキスト → 日本仕様
   - 変更前: 「おはようございます、Mikoto」
   - 変更後: 「東海林さん、おはようございます」
   - サブテキスト「今日も素敵な一日を。業務の成長をサポートします。」維持
   - ユーザー名は ShojiStatus または root_employees から動的取得

5. 右上ユーザー情報 → 日本仕様
   - 上段（名前）: 「Mikoto Sato」→「東海林 美琴」（root_employees.name 動的）
   - 下段: 雇用形態 / 権限「正社員 / 全権管理者」（root_employees.employment_type / garden_role 動的）
   - 表示形式: `{employment_type} / {role_label}`
   - 例: 正社員 / 全権管理者 (super_admin) / 正社員 / 管理者 (admin) / 派遣社員 / 一般 (staff)

6. 左下ヒントカード → ヘルプ機能入口（KING OF TIME 風）
   - カードタイトル: 「ヘルプ」（既存「成長のヒント」から変更）
   - 説明文: 「Garden の使い方が分からない時はこちら。Q&A 検索・操作ガイド・動画解説が揃っています。」
   - ボタン: 「ヘルプを開く」→ /help (Garden ヘルプモジュール、Phase D-E 起草、暫定で外部ヘルプサイトリンク or placeholder ページ)
   - memory `project_garden_help_module.md` 参照

7. 検索ショートカット表記 → Windows 仕様
   - 変更前: Mac 風（⌘K, ⌘ アイコン等）
   - 変更後: 「Ctrl+F」テキスト表示
   - キーボードイベントもサポート（Ctrl+F で検索フォーカス）、prefers-reduced-motion 関係なし

7.5 ⭐ 背景クリック → 次の atmosphere（追加 4/27、東海林さん insight）
   - 背景の null space（モジュールアイコン・カード・ヘッダー・サイドバー以外）をクリック → 次の atmosphere に遷移
   - fade transition 800ms（既存 BackgroundCarousel の transition 流用、"ふぁん"とした柔らかい変化）
   - 実装ポイント:
     - BackgroundCarousel に onClick handler 追加
     - event.target を確認、UI 要素（ModuleSlot / KPI カード / Today's Activity / ヘッダー / サイドバー / hint card 等）の場合は伝播停止 (e.stopPropagation)
     - 背景レイヤー (BackgroundLayer 自体) の click のみ atmosphere 遷移
   - キーボードショートカット（1-6 / A / ←→ / Space）と完全互換、独立動作
   - tests: 背景クリックで次 atmosphere 遷移 6 ケース、UI 要素クリック時は不発火 5 ケース、auto モード中の click でも遷移する 1 ケース、計 12 ケース追加

8. ⭐ Garden 全体ログイン画面 新規実装 + 権限別ルーティング
   - 新 path: /login（既存 /bloom/login, /forest/login, /tree/login 等は残存）
   - 参考画像: design-references/login-design-reference-v2-right-aligned.png（4/27 v2、**配置場所のみの参考**）
   - **採用レイアウト** (東海林さん 4/27 最終確定、シンプル化版):
     - **左 40%**: フォーム（社員番号 + パスワード 2 項目のみ）+ ログイン状態保持 + ログインボタン（緑グラデ + 葉アイコン）+ パスワード忘れリンク + ロゴ最小限（Garden Series + 業務を、育てる）
     - **右 60%**: home 画面と同じ atmosphere（大樹背景、Var 1 Morning Calm 推奨）**のみ、追加要素なし**
   - **不要な要素**（v2 image にあったが除外）:
     - ❌ 大見出し「東海林さんを、やさしく迎える業務 OS。」
     - ❌ 特徴ハイライト 3 つ（透明感のある操作感 / 12 のモジュール / 自然と Tech の調和）
     - ❌ SSO ログインボタン
     - ❌ サブテキスト
   - **理由**: home 画面の大樹背景が右配置なので、ログインフォームを左配置にして視覚バランス + 統一感。シンプルな login UX で迷わせない
   - その他: 緑グラデの「ログイン」ボタン + 「パスワード忘れ」リンクのみ
   - 動的化（一度ログイン後の名前保持等）は後追い、初版は固定テキストで OK
   - 認証成功時 権限別 redirect:
     - super_admin / admin / manager / staff → /home
     - closer / toss → /tree
     - cs → /home（暫定、5/5 後確定）
     - outsource → partner_code に紐付く商材依存:
       - 単一商材 → /leaf/{product}（例: /leaf/kanden）
       - 複数商材 → /leaf（overview + filter UI、後追い）
       - **暫定実装**: 5/5 デモまでは `/leaf/kanden` ハードコード可、partner_code lookup は後追い spec
   - 実装: src/app/login/page.tsx + src/app/_lib/auth-redirect.ts
   - 関連: memory `project_garden_dual_axis_navigation.md` v3 §7 参照（outsource partner_code 設計含む）

▼ 実装ステップ（合計 1.0-1.5d 想定）

| Step | 内容 | 工数 |
|---|---|---|
| 1 | garden-logo.webp 配置 + ヘッダーロゴ差替 | 0.05d |
| 2 | 12 モジュール並び順 + ラベル変更（英語 + サブ説明） | 0.15d |
| 3 | 挨拶テキスト + ユーザー情報の動的化 | 0.1d |
| 4 | 左下ヒントカード → ヘルプ入口に改修 | 0.1d |
| 5 | 検索ショートカット Ctrl+F 表記 + キーイベント | 0.05d |
| 6 | Garden 全体ログイン /login 新規実装 | 0.4d |
| 7 | 権限別 auth-redirect ロジック | 0.1d |
| 8 | tests（25-30 ケース）+ snapshot | 0.2d |

▼ 制約
- Mode 1（Subagent-Driven）継続
- 既存 6 atmospheres カルーセル（候補 6）+ 12 透明アイコン + hover 演出（第 1 波 + 候補 7 v4）と完全互換
- 既存 /bloom/login, /forest/login, /tree/login 等のモジュール直接ログイン は維持（template 統一は後追い）
- design-references v1 はあくまで参考、忠実に再現する必要なし、Garden 世界観 + デザインセンス向上が目標

▼ 詰まり時
即停止 → a-main 経由で東海林さんに相談
特に Step 6（Garden 全体ログイン）の認証フローは Forest/Bloom/Tree 既存パターンと統合する必要あり、判断保留があれば即停止

▼ 報酬
これで 5/5 後道さんデモのホーム画面 + ログイン画面が完成形に到達、デザインセンス + 権限別 UX が完璧に整う。
品質最優先で進めてください。
```

## 2. 参考画像詳細

### home-design-reference-v1.png

ChatGPT 生成（4/27 14:33）。レイアウト構成：
- 上部ヘッダー: Garden Series ロゴ + 検索バー + 日付温度 + システム状況 + ユーザー
- 左サイドバー: ホーム / ダッシュボード / 取引 / 顧客 / ワークフロー / レポート / 設定（業務ドメイン軸、staff 以上）
- 中央メイン: 挨拶 + 4 つの KPI カード + 12 モジュールアイコン 4×3 grid
- 右サイドバー: Today's Activity 通知フィード
- 左下: ヒントカード（→ ヘルプに変更）
- 背景: atmosphere（Var 1 Morning Calm）

### login-design-reference-v1.png

ChatGPT 生成（4/27 14:41）。レイアウト構成：
- 背景: atmosphere（Var 1 Morning Calm）
- 中央: フロストガラスカード（backdrop-filter blur、半透明白）
- 内部: Garden Series ロゴ + 業務を、育てる + キャッチ + 入力フィールド（**修正後 2 項目**）+ ログイン状態保持 + ログインボタン + パスワード忘れ + Secure workspace footer

## 3. 権限別ルーティング 仕様（memory v2 §7 反映）

| 権限 | redirect 先 | 設計意図 |
|---|---|---|
| super_admin | `/home` | 東海林さん 1 名、全モジュール俯瞰 |
| admin | `/home` | 全権管理、業務全体俯瞰 |
| manager | `/home` | 部下管理、業務全体俯瞰 |
| staff | `/home` | 一般正社員、業務全体俯瞰 |
| closer | `/tree` | 架電業務専用 |
| toss | `/tree` | 架電業務専用 |
| cs | `/home`（暫定）| Tree + Leaf 両方アクセス、5/5 後確定 |
| outsource | partner_code に紐付く商材依存（単一→`/leaf/{product}`、複数→`/leaf`）| **partner_code 設計**: root_partners 経由で商材判定、自分の案件のみ閲覧 |

## 4. 完了基準

- 8 件改善が design-reference v1 と整合（visual 確認）
- /login 新規実装で 8-role redirect 動作
- 既存 atmospheres カルーセル + hover 演出と完全互換
- tests 25-30 ケース PASS
- localhost で動作確認
- Bloom-002 完走報告 + a-review 依頼

## 5. CS 権限の判断保留事項

CS の redirect 先は 3 案候補（memory v2 §7 参照）。**5/5 後道さんデモ後に確定**：
- 案 1: /home（暫定実装、grid から選択）
- 案 2: 業務開始前選択画面（Tree or Leaf）
- 案 3: 個人設定でデフォルト遷移先選択

→ Bloom-002 は **案 1（暫定）で実装**、確定後に短時間で変更可能な構造で実装。

## 6. 改訂履歴

- 2026-04-27 初版（a-main 008、ChatGPT デザイン参考 v1 受領 → 8 件改善 + 権限別ルーティング統合 dispatch、~1.0-1.5d 想定）
