# 【a-auto 周知】to: a-main

- 発信日時: 2026-04-25 02:00
- 発動シーン: 就寝前モード継続（a-auto 002、Batch 9 直後に Batch 10 連続発動）
- a-auto 稼働時間: Batch 9 約 50 分 + Batch 10 約 50 分 = **累計約 1 時間 40 分**

---

## a-auto が実施した作業（Batch 10）

Garden シリーズ全モジュール横断の UI 設計書 **6 件完走**。レイアウト・メニューバー・個人カスタマイズ・時間帯テーマ・達成演出・アクセス動線の全領域をカバー。

| # | ファイル | 行 | 見積 | 優先度 |
|---|---|---|---|---|
| UI-01 | layout-theme | 425 | 0.6d | 🔴 最高 |
| UI-02 | menu-bars | 400 | 0.5d | 🔴 最高 |
| UI-03 | personalization | 576 | 0.7d | 🔴 高 |
| UI-04 | time-theme | 445 | 0.4d | 🟡 中 |
| UI-05 | achievement-effects | 442 | 0.5d | 🟡 中 |
| UI-06 | access-routing | 472 | 0.4d | 🔴 高 |

**合計 2,760 行 / 実装見積 3.1d**（画像調達除く）

---

## 触った箇所

- ブランチ: `feature/cross-ui-design-specs-batch10-auto`（develop 派生、`8331585` 基点）
- 新規ファイル（9 件）:
  - `docs/specs/2026-04-25-cross-ui-01-layout-theme.md`
  - `docs/specs/2026-04-25-cross-ui-02-menu-bars.md`
  - `docs/specs/2026-04-25-cross-ui-03-personalization.md`
  - `docs/specs/2026-04-25-cross-ui-04-time-theme.md`
  - `docs/specs/2026-04-25-cross-ui-05-achievement-effects.md`
  - `docs/specs/2026-04-25-cross-ui-06-access-routing.md`
  - `docs/broadcast-202604250200/summary.md`
  - `docs/broadcast-202604250200/to-a-main.md`（本ファイル）
  - `docs/autonomous-report-202604250200-a-auto-cross-ui.md`
- 既存ファイル編集: **なし**（spec 起草のみ、UI 実装コードは一切触らない）
- コミット: 後述（1 本、`[a-auto]` タグ付与）
- push 状態: 完了
- PR: **自動発行**（Batch 9 で #31 だったので、今回は #32 想定）

---

## あなた（a-main）がやること（3 ステップ）

1. **`git pull origin develop`** で最新化（本 PR は develop 未マージの段階）
2. **`docs/broadcast-202604250200/summary.md` を読む** → Batch 10 全容把握
3. **判断保留 6 件を東海林さんに提示** + 各モジュールセッションへの配布用短文生成

---

## 判断保留事項（東海林さん向け、最優先 6 件）

以下 6 件は実装前に東海林さんの判断が必要：

| # | 論点 | a-auto 推定スタンス | spec |
|---|---|---|---|
| 1 | Fruit（実）のホーム画面表示 | 薄く表示（opacity 0.4）+ クリック無効 + tooltip 「概念モジュール」 | UI-01 判2 |
| 2 | アプリアイコンセット | 独自 SVG（ブランド一貫性、1 回払いコスト） | UI-02 判6 |
| 3 | heic 変換ライブラリ | `heic2any`（bundle +300KB、iPhone 対応優先） | UI-03 判1 |
| 4 | 時間帯画像 15 枚調達 | AI 生成（DALL-E / Midjourney）でコスト抑制 | UI-04 判1 |
| 5 | 花火演出の負荷 | Phase 1 で実測、低スペックは SVG fallback | UI-05 判1 |
| 6 | 扉のデザイン | 和風モチーフ（Garden = 庭）、デザイナー相談 | UI-06 判5 |

他 35 件は各 spec §最終章に集約、優先度中〜低（実装直前確認で OK）。

---

## 累計判断保留（Batch 7-10）

| Batch | 件数 | 最優先件数 |
|---|---|---|
| Batch 7 横断基盤 | 40 | 5 |
| Batch 8 Leaf 関電 | 43 | 5 |
| Batch 9 Tree D | 42 | 5 |
| **Batch 10 横断 UI** | **41** | **6** |
| **累計** | **166** | **21** |

---

## 累計（Batch 1-10）

| Batch | 対象 | spec 数 | 行 | 工数 |
|---|---|---|---|---|
| 1-8 | Phase A-C + 横断 + Leaf C | 46 | ~18k | 23.95d |
| 9 | Tree Phase D | 6 | 2,544 | 5.1d |
| **10** | **Garden 横断 UI** | **6** | **2,760** | **3.1d** |
| **合計** | — | **58** | **~23k** | **約 32.15d** |

---

## 次に想定される作業（東海林さん向け）

### 短期（M2 前 = 2026-06 まで）
- 優先 21 件（Batch 7-10 合算）の判断合意 → `docs/decisions/` に起草
- 時間帯テーマ画像 15 枚の調達方針決定（AI 生成 or 外注）
- Batch 2/3 Forest spec の PR 化（a-main タスク、Batch 8 引継ぎ継続）

### 中期（M2-M3 = 2026-06 〜 2026-07）
- UI-01 + UI-02 の Phase 1a 実装（基盤のみ、画像なしで動作）
- 各モジュールの既存 theme.ts を CSS variables に段階移行

### 長期（M3-M6 = 2026-07 〜 2026-10）
- UI-03（個人カスタマイズ）/ UI-04（時間帯）実装
- UI-05（達成演出）は Phase 2 として余裕を持って投入
- Bud Phase C（年末調整）Batch 着手

---

## Batch 10 の独自ハイライト

### 1. 既存モジュールとの共存設計
CSS variables への段階移行を明示。既存 FOREST_THEME / LIGHT_THEME は当面 maintain し、Phase 3 で統一削除。**移行中の UI 崩れをゼロに抑える**設計。

### 2. shadcn/ui の活用方針確定
Button/Dialog/Dropdown/Toast/Tooltip の 5 種を Phase 1 で導入、`ActionButton`（Tree 独自）等のモジュール固有コンポーネントは維持。**重複実装を減らしつつ独自性保持**。

### 3. 権限別動線の明文化
toss/closer → Tree 自動遷移（Netflix 風 2 秒）を §18 Phase D の最慎重運用と統合。 **非 Tree 利用者の UX も配慮**（admin / cs 等はホーム留）。

### 4. アクセシビリティ徹底
prefers-reduced-motion / 色覚対応 / キーボード操作 / WCAG AA を全 spec に織り込み。特に時間帯テーマ（UI-04）の色覚対応、達成演出（UI-05）の動き削減対応が丁寧。

### 5. ブランドカラー × コントラスト検証
10 モジュール × 白/黒背景の組み合わせで WCAG AA 検証（§5.3）、テキスト色として使う場合は `-dark` バリアント推奨を明示。

### 6. 画像調達の現実解
時間帯テーマ 15 枚は AI 生成で Phase 1 コスト抑制。好評なら Phase 2 で外注・高品質版に差替というステップ設計。

---

## a-auto 002 使用枠サマリ（累計）

- **累計稼働時間**: 約 1 時間 40 分（Batch 9 + Batch 10）
- **成果物**: 12 spec / 5,304 行 / 実装見積 **8.2d**（Batch 9: 5.1d + Batch 10: 3.1d）
- **残り枠**: 5 時間枠の約 33% 消費、余裕あり
- **停止理由**: Batch 10 の全 6 タスク完走（停止条件 1）
- **次アクション**: Batch 11 追加要請がなければ、本セッション a-auto 002 は待機状態

### Batch 11 候補（ご検討材料）

| 候補 | 対象 | 見積 | 性質 |
|---|---|---|---|
| A | Bud Phase C（年末調整・退職金）| 3.5d | M6 前の準備 |
| B | Leaf 他商材スケルトン（光回線・クレカ等 3-5 商材）| 1.0-2.0d | 軽量バッチ、判断少 |
| C | Soil / Rill 基盤設計 | 3.0d | M4-M6 着手前 |
| D | Seed（新事業枠）基盤 | 1.5d | 新規モジュール |

---

— a-auto 002 就寝前モード Batch 10 完走 / セッション通算 12 spec 完走 —
