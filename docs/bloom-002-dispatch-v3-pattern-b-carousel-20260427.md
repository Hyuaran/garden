# Bloom-002 dispatch v3 - Pattern B 6 atmospheres カルーセル + 12 module icons - 2026-04-27

> 起草: a-main 008
> 用途: Bloom-002 への 5/5 後道さんデモ用 UI 実装 dispatch（最終確定版）
> 戦略: Pattern B（実物 UI 切替）で 6 atmospheres カルーセル + 12 透明モジュールアイコンを統合
> 前提: 全素材は `_shared/attachments/20260427/ai-images/` 配下に配置済（背景 6 枚 + アイコン 12 枚透明版）
> 関連: `_shared/decisions/godo-pattern-b-fullspec-20260427.md`（戦略書、参照）/ `bloom-phase-2-2-dispatch-prep-v2-20260427.md`（旧版、本書で置換）

## 1. 5/5 デモの最終形

```
[5/5 当日]
東海林さんが Bloom-002 ローカルを後道さんに見せる
↓
ホーム画面に 12 透明モジュールアイコン + 6 atmospheres カルーセル背景
↓
カルーセルが 1 → 2 → 3 → 4 → 5 → 6 → 1 と循環（自動 + キーボード送り可能）
↓
各 atmosphere で違う表情を見せ、後道さんの「どれが好き？」直感反応を引き出す
↓
モジュールアイコンに hover で 12 種固有演出（既存第 1 波の成果）
↓
反応観察 → 採択方向決定 → 後追い実装で final 化
```

## 2. dispatch 短文（コピペ用、東海林さんが Bloom-002 へ投下）

```
【a-main-008 から Bloom-002 へ】Phase 2-2 候補 6 着手 (Pattern B カルーセル統合版)

▼ 戦略確定
5/5 後道さんデモ方式が **Pattern B（実物 UI 切替）** + **6 atmospheres カルーセル** + **12 module 透明アイコン** に確定。
全素材は `_shared/attachments/20260427/ai-images/` に配置済、即着手可能。

▼ 必要素材（既配置）

1. 6 atmospheres 背景画像（WebP、計 750 KB）
   - source: `_shared/attachments/20260427/ai-images/digital-terrarium/`
   - files (cycle order):
     1. digital-terrarium-watercolor-tree.webp（穏やか、最も絵画的、最初に表示）
     2. digital-terrarium-morning-calm.webp（朝もや、静謐）
     3. digital-terrarium-dynamic-energy.webp（斜光、活力）
     4. digital-terrarium-analytical-precision.webp（透明感、洗練）
     5. digital-terrarium-system-sync.webp（接続線、連携）
     6. digital-terrarium-workflow-flow.webp（水循環、コミュニケーション）

2. 12 透明モジュールアイコン（WebP alpha、計 ~2.1 MB）
   - source: `_shared/attachments/20260427/ai-images/module-logos/transparent/`
   - files: soil.webp / root.webp / rill.webp / tree.webp / leaf.webp / bud.webp / sprout.webp / bloom.webp / forest.webp / fruit.webp / seed.webp / calendar.webp
   - スタイル: ガラスクリスタル統一、透明背景

▼ 実装範囲

1. 素材配置（public/ 配下）
   - public/themes/atmospheres/01-watercolor-tree.webp 〜 06-workflow-flow.webp（カルーセル順、prefix で順序明示）
   - public/themes/module-icons/{module}.webp（12 ファイル）
   - 出典は `_shared/attachments/...` から複製、git に commit OK（atmospheres + module-icons のみ、explore は除外）

2. BackgroundLayer のカルーセル化
   - props: `atmosphereIndex: 0..5`（current carousel position）
   - props: `mode: 'auto' | 'manual'`（auto = 一定間隔切替、manual = キーボード/ボタン制御）
   - auto モード: setInterval で 8 秒ごとに次の atmosphere に切替（fade transition 800ms）
   - manual モード: 矢印キー or 画面端のボタンで切替

3. キーボードショートカット（5/5 デモ用）
   - `→` / `Space` / `→` 矢印: 次の atmosphere
   - `←`: 前の atmosphere
   - `1` 〜 `6`: 直接ジャンプ（5/5 当日に東海林さんが操作）
   - `A`: auto / manual トグル
   - 既存 hover 演出ショートカット（カスタム key map）と衝突なし

4. ModuleSlot の icon 置換
   - 既存 ModuleSlot コンポーネント（Phase 2-0 で実装済）の icon prop を WebP 透明アイコンに切替
   - 12 モジュール各々に対応する webp 配置
   - サイズ: 64×64px（responsive）、retina 対応

5. URL クエリパラメータでの atmosphere 直接指定（dev 用）
   - `/?atmosphere=0` 〜 `/?atmosphere=5` で起動時に特定 atmosphere に固定
   - default は 0 (watercolor-tree)
   - 5/5 当日は使わないが、開発時の便宜

6. 既存 hover 演出（第 1 波）と完全互換維持
   - cross-ui-06 §2.5 hover アニメーション（commit d12c7e4 + a7f1b26）はそのまま
   - 12 透明アイコンに対しても同じ hover 演出が動く
   - prefers-reduced-motion 対応継続

7. tests
   - BackgroundLayer のカルーセル auto/manual モード切替 4 ケース
   - キーボードショートカット 1〜6 / A / ←→ 各 1 ケース = 8 ケース
   - URL クエリパラメータ → atmosphere 反映 6 ケース
   - ModuleSlot の透明アイコン表示 12 ケース（snapshot）
   - 既存 hover 演出が透明アイコンでも動作 12 ケース
   - 計 ~42 ケース

▼ 実装ステップ（合計 0.5d 想定）

| Step | 内容 | 工数 |
|---|---|---|
| 1 | 素材配置（public/themes/atmospheres + module-icons） | 0.05d |
| 2 | BackgroundLayer カルーセル化（auto/manual + fade transition） | 0.15d |
| 3 | キーボードショートカット実装（1-6 / A / 矢印） | 0.05d |
| 4 | ModuleSlot に透明アイコン適用 | 0.05d |
| 5 | URL クエリパラメータ → atmosphere 反映 | 0.05d |
| 6 | tests 約 42 ケース + snapshot | 0.15d |

▼ 制約

- Mode 1（Subagent-Driven）継続
- 候補 6 完走 → 即 a-main 経由で進捗報告（後道さん 5/5 デモのため最優先）
- 既存 hover 演出（第 1 波 d12c7e4 + a7f1b26）と完全互換維持
- カルーセル切替は accessibility 配慮（prefers-reduced-motion で auto 無効化、manual 維持）
- 8 秒間隔は固定値、後で TimeThemeProvider 統合時に環境連動可能設計

▼ 詰まり時
即停止 → a-main 経由で東海林さんに相談

▼ 報酬
これで Garden Series ホーム画面が **6 atmospheres カルーセル + 12 透明アイコン + hover 演出** の完成形に到達。
後道さん 5/5 デモで「Tech と Nature の調和」を完全な体験として表現、UX 採用ゲート対応の最終 build。
品質最優先で進めてください。
```

## 3. 5/5 デモシナリオ v3（Pattern B カルーセル版）

| Phase | 時間 | 内容 |
|---|---|---|
| 1. つかみ | 0:00-0:30 | 「Garden の画面、見てもらえますか？」+ Bloom-002 起動（atmosphere 1 watercolor-tree default 表示）|
| 2. カルーセル開始 | 0:30-1:00 | キー `A` で auto モード開始、8 秒ごとに 1 → 2 → 3 → 4 → 5 → 6 を見せる |
| 3. カルーセル一周 | 1:00-2:30 | 6 atmosphere を全て見終える、東海林さんは横で「これは朝もやの atmosphere、これは活力時、これは...」と短く解説 |
| 4. 反応引き出し | 2:30-4:30 | キー `1` 〜 `6` で気になった atmosphere に戻れる「どれが好きでしたか？」と聞く |
| 5. 12 アイコン演出 | 4:30-5:30 | hover 演出 1-2 種を見せる「触ると応えるんです」 |
| 6. 質問対応 | 5:30-6:30 | 「これいつ使える？」「画面の絵は？」「機能は？」 |

## 4. 完了基準

- 6 atmosphere カルーセル動作（auto/manual + 矢印キー + 1-6 ジャンプ + `A` トグル）
- 12 透明アイコン ModuleSlot 表示
- 既存 hover 演出が 12 アイコンで完全動作
- tests ~42 ケース PASS
- Bloom-002 完走報告 + a-review 依頼

## 5. 改訂履歴

- 2026-04-27 初版（a-main 008、Pattern B 6 atmospheres カルーセル + 12 透明アイコン統合 dispatch v3、合計 0.5d 想定）
