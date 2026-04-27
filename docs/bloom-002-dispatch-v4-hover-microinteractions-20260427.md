# Bloom-002 後追い dispatch v4 - Hover micro-interactions（単音 + ふわっと拡大）- 2026-04-27

> 起草: a-main 008
> 用途: 5/5 後道さんデモ前 / 5/5 デモ向けの最終仕上げ実装
> 戦略: モジュールアイコン hover 時の触感を「単音 + ふわっと拡大 + 既存固有演出」の三重構造で完成
> 前提: Bloom-002 候補 6（Pattern B カルーセル統合版）完走済（commits e87180/32b2c35/624f593/4de990f）+ 第 1 波 hover 演出（d12c7e4 + a7f1b26）
> 関連 memory: `project_garden_3layer_visual_model.md` v4 §Hover micro-interactions

## 1. 投下用 dispatch 短文（コピペ用）

```
【a-main-008 から Bloom-002 へ】Phase 2-2 候補 7 着手 (Hover micro-interactions 三重構造)

▼ 戦略
モジュールアイコン hover 時の触感を「単音 + ふわっと拡大 + 既存固有演出」の三重構造で完成させ、5/5 後道さんデモの感性訴求を最大化。

▼ 実装範囲

1. ふわっと拡大の強化
   - 既存 ModuleSlot hover transform を拡張
   - hover 時 `transform: scale(1.08) translateY(-4px)` を 0.6s ease-out で適用
   - 既存 hover 演出（葉揺れ・月瞬き等）と合算した最終的な transform を計算
   - prefers-reduced-motion = reduce 環境では scale 1.0 維持

2. 単音（モジュール固有 12 種）追加
   - 各モジュール固有の自然物的単音を再生（hover 開始 0.1s 後）
   - 音源配置: public/sounds/module-hover/{module}.webm or mp3
   - 12 ファイル: soil / root / rill / tree / leaf / bud / sprout / bloom / forest / fruit / seed / calendar
   - 音量: 0.3-0.4（控えめ、環境音楽風）
   - HTML5 Audio API、preload 'metadata'（初回 hover で軽量読込）

3. ユーザー設定（ON/OFF トグル）
   - localStorage key: `garden-module-hover-sound`
   - default: false（既定 OFF、§memory `feedback_quality_over_speed_priority`）
   - 設定 UI: ヘッダーまたは設定画面に「音響効果 ON/OFF」トグル
   - prefers-reduced-motion = reduce 環境では強制 OFF（設定上書き不可）

4. 既存 hover 演出との両立
   - 第 1 波 hover 演出（commits d12c7e4 + a7f1b26）の 12 種固有アニメーションは完全維持
   - keyframes 名前空間 gv-* と衝突なし
   - data-module-key 属性経由で各モジュールの音 + 演出を分離管理

5. INPUT/TEXTAREA/SELECT/contenteditable 内では発火しない
   - 既存 BackgroundCarousel keyboard handler と同パターン
   - focus 状態判定で hover 演出 + 音再生を抑制

6. tests
   - ふわっと拡大の transform 値テスト 12 ケース
   - 単音再生の HTML5 Audio API モック 12 ケース
   - localStorage 設定 ON/OFF 切替 4 ケース
   - prefers-reduced-motion 環境での強制 OFF 1 ケース
   - INPUT focus 内での発火抑制 4 ケース
   - 計 ~33 ケース

▼ 音源の調達
  - 案 A: フリー素材サイト（freesound.org / ドラム音.com 等）から自然物的単音 12 個ダウンロード、東海林さん側で整備
  - 案 B: AI 生成（ChatGPT で「自然物の効果音、12 種」依頼）、東海林さん側
  - 案 C: 音源探索コスト回避、scale 拡大のみ実装、単音は将来課題（5/5 後）

  → ★ 推奨: **案 C（scale のみ）を 5/5 デモまでに実装、単音は採択後の追加 dispatch**
  ★ 理由: 音源 12 種探索は 0.5d 程度かかる、5/5 まで時間タイト、scale ふわっとだけでも十分後道さん訴求できる

▼ 実装ステップ（案 C 前提、合計 0.2d 想定）

| Step | 内容 | 工数 |
|---|---|---|
| 1 | ふわっと拡大の transform 強化 | 0.05d |
| 2 | 既存 hover 演出との合算 transform 計算 | 0.05d |
| 3 | INPUT focus 内 抑制（既存 keyboard handler パターン）| 0.025d |
| 4 | tests 約 17 ケース（拡大 12 + focus 抑制 4 + reduced-motion 1）| 0.075d |

▼ 制約
- Mode 1（Subagent-Driven）継続
- 既存 hover 演出（第 1 波 commits d12c7e4 + a7f1b26）と完全互換維持
- 既存 BackgroundCarousel（候補 6）keyboard handler と非干渉
- Phase 2-2 候補 6 完了後の追加実装、累計 commit 数 +2-3

▼ 詰まり時
即停止 → a-main 経由で東海林さんに相談

▼ 報酬
これで 5/5 後道さんデモの感性訴求がさらに強化、「触ると応える」体感が視覚 + 動作 + （将来）音響の多重モーダル。
品質最優先で進めてください。
```

## 2. 案 C（scale のみ、5/5 までに実装）を推奨する理由

| 理由 | 内容 |
|---|---|
| 5/5 まで残 8 日 | 音源探索 0.5d は 5/5 リハーサル準備時間を圧迫 |
| デモ品質確保 | scale ふわっとだけでも後道さんの「おっ」反応を引き出せる、リスク低 |
| 採択前の過剰投資回避 | 音源は採択後（後道さん「いい」反応）の追加実装で十分 |
| 既存 hover 演出強化 | 第 1 波の 12 種固有アニメ + scale 強化で十分インパクト |

## 3. 5/5 後の単音実装計画（採択後追加）

### Phase A: 音源調達（東海林さん 0.5d）

候補:
- **freesound.org** - CC0 / CC-BY ライセンス、自然物の効果音多数
- **ChatGPT 4o Audio** - 効果音生成（要試行）
- **YouTube 音声ライブラリ** - ロイヤリティフリー
- **既存音源切り出し** - 既に Garden で使ってる音から流用

12 種の自然物単音：ぽとっ・ピチョン・カラン・サラ・プチ 等（memory v4 §Hover micro-interactions 参照）

### Phase B: Bloom-002 dispatch（0.2d）

```
【a-main から Bloom-002 へ】Phase 2-2 候補 8 着手 (単音追加)

▼ 5/5 デモ反応
後道さん: 「いい」（採択）or「迷う」（採択検討）

▼ 実装範囲
1. public/sounds/module-hover/{12 module}.webm 配置
2. ModuleSlot hover で 0.1s 遅延後に再生
3. localStorage トグル UI（ヘッダー or 設定画面）
4. tests 16 ケース

▼ 工数: 0.2d
```

## 4. 完了基準（v4 後追い dispatch）

### 案 C 採用時（5/5 まで）
- ふわっと拡大の transform 強化動作（hover で scale 1.08 + translateY -4）
- 既存 hover 演出 12 種が完全維持
- INPUT focus 内での発火抑制
- prefers-reduced-motion = reduce で scale 1.0 維持
- tests ~17 ケース PASS
- Bloom-002 完走報告 + a-review 依頼

### Phase B 単音追加時（5/5 後）
- 12 ファイル配置 + Audio API 再生
- localStorage トグル UI 実装
- 既定 OFF + reduced-motion 強制 OFF
- tests 16 ケース PASS

## 5. 改訂履歴

- 2026-04-27 初版（a-main 008、東海林さん「単音 + ふわっと拡大」案受領 → 5/5 までに案 C scale のみ実装、5/5 後に単音 Phase B として追加 dispatch）
