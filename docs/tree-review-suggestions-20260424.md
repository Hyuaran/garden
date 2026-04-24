# Garden-Tree レビュー提案 - 2026-04-24

- 作成元セッション: **a-auto**（自律実行モード / 集中別作業中・約30分枠）
- 作業ブランチ: `feature/tree-review-20260424-auto`（`feature/tree-phase-b-beta` から派生）
- 対象: `src/app/tree/` および `docs/` 配下の現状把握ベースの提案
- 目的: **改修指示ではなく「観察結果 + 判断材料」の提示**。実装判断は a-tree セッション（東海林さん承認のうえ）で行う。

---

## a. コード品質の気づき（5項目）

### 1. インライン `style={{...}}` の多用と Tailwind 未採用
`login/page.tsx` / `birthday/page.tsx` / `TreeAuthGate.tsx` などで CSS-in-JS（インラインstyle）が広く使われている。一方 a-bud は Tailwind ベース。
- **影響**: モジュール間でスタイル手法が分裂しており、再利用・保守・レビュー負荷が上がる。同じ `inputStyle` 定数が複数ファイルに重複。
- **観察**: `GlassPanel` / `WireframeLabel` / `ActionButton` など共通化コンポーネントは十分に切り出されているので、内部実装を Tailwind へ段階移行してもAPIは変わらない。

### 2. 誕生日入力と Auth パスワード同期のエラー分岐が3段シリアル
[birthday/page.tsx:63-88](C:/garden/a-tree/src/app/tree/birthday/page.tsx) では `updateBirthday` → `updatePasswordFromBirthday` → `refreshAuth` の3段階を逐次実行。
- 2段目（pw更新）失敗時は「誕生日は保存されましたが…」と部分成功メッセージを返すが、**部分成功状態からの復帰パス（再実行ボタンなど）が未提供**。
- 画面リロードすると `treeUser.birthday !== null` のため同画面へ戻れず詰む可能性。

### 3. `<img>` への `eslint-disable @next/next/no-img-element`
[login/page.tsx:127](C:/garden/a-tree/src/app/tree/login/page.tsx) で `next/image` を回避している。
- `LOGO_PATH` が固定 SVG ならパフォーマンス影響は小さいが、disable コメントは意図説明が無いため新規参画者が理由を追えない。コメントに理由を1行添える or `next/image` へ置換が望ましい。

### 4. `_constants/screens.ts` と実ルートの整合性未検証
`TREE_PATHS` に多数のパスが定義されているが、サイドバーのナビ項目・実ファイルの `page.tsx` と同期しているかの検証は手作業。
- **観察**: `breeze/page (1).tsx` のようなコピー残留が `src/app/tree/breeze/` に存在（`page (1).tsx`）。ビルド/ルーティングに影響はしないが、意図せぬファイルの可能性。

### 5. `TreeAuthGate` の useEffect 依存に `treeUser` が明示されていない
[TreeAuthGate.tsx:45](C:/garden/a-tree/src/app/tree/_components/TreeAuthGate.tsx) の依存配列は `needsBirthday` 経由で間接的に `treeUser` を観測している。
- 現状は `needsBirthday` が再計算されれば追随するので挙動上は問題ないが、将来 `treeUser` の別フィールドに分岐を足したくなったとき依存漏れのリスクが残る。lint ルール的にも曖昧な書き方。

---

## b. アクセシビリティ / レスポンシブ改善案（3項目）

### 1. エラー表示に `role="alert"` / `aria-live` を付与
`login/page.tsx:208-220`・`birthday/page.tsx:178-190` のエラーメッセージは視覚的には赤字で出るが、スクリーンリーダーには通知されない。コールセンター業務ゆえ読み上げ利用は少ない想定だが、モバイル VoiceOver 想定で 1 行追加の費用対効果は高い。

### 2. 入力フィールドに `aria-invalid` / `aria-describedby`
ログイン・誕生日ページのテキスト入力はエラー状態でも視覚スタイルが変わらない（境界線色は focus 時のみ変化）。`aria-invalid={!!error}` と `aria-describedby="err-id"` を追加することで、エラー状態の明示と支援技術への通知が両立する。

### 3. モバイル幅での固定横幅 380/420px
`GlassPanel` に `width: 380` / `width: 420` を直接渡しているため、320px 幅端末で横スクロールが出る可能性。`max-width + width: "100%" + padding-inline` へ移行すると iPhone SE 等の狭幅でも自然に収まる。

---

## c. 未ドキュメント化の機能・仕様（5項目）

docs/ 配下の既存文書は `handoff-20260422.md` / `handoff-20260423.md` / `effort-tracking.md` の3点のみで、以下の仕様・挙動が**実装のみに存在**し設計文書化されていない。

1. **Phase B-β 誕生日パスワード同期フロー**
   誕生日入力 → `/api/tree/update-password`（service_role_key 前提）で Auth パスワードも MMDD に自動更新する仕組みの設計根拠・運用手順が未記録。パスワード変更ポリシーが変わった場合の影響範囲が追えない。

2. **擬似メール変換（社員番号 → email）**
   `signInTree` で社員番号を擬似 email に変換して Supabase Auth に投入している仕様のフォーマット・衝突回避規則が未文書化。

3. **マイページ定期確認ロック**（Phase 1 コミットに言及あり）
   `fix(tree): 表記揺れ修正＋マイページ定期確認ロック機能` というコミットに含まれる「定期確認ロック」の発火条件・解除条件・UX設計が未ドキュメント。

4. **`_constants/screens.ts` の TREE_PATHS 全量**
   サイドバー・ゲート・個別ページから参照される中心定義だが、どのパスが未実装／POC／本番用かの区分表が無い。

5. **Bare screen 扱いのページ一覧**
   `login` / `birthday` が TreeShell の「サイドバー・KPIヘッダー非表示」モードになる旨がコード注釈のみ。今後 `bare screen` を追加する際のルール（TreeShell 側のフラグ列挙）が未定義。

---

## d. 優先度マトリクス

| 種別 | 項目 | 優先度 | 根拠 |
|---|---|---|---|
| コード | 2. 誕生日同期の部分成功復帰 | 🔴 | 詰む経路があり、本番投入前に必要 |
| コード | 1. インラインstyle統一 | 🟡 | 品質課題だが即時リスクは無い |
| コード | 4. 画面定数と実ルート整合 | 🟡 | `page (1).tsx` 等のゴミファイル混在 |
| コード | 5. useEffect依存の明示化 | 🟢 | 将来リスク予防 |
| コード | 3. `<img>` 置換 | 🟢 | パフォーマンス影響は小 |
| A11y | 1. role=alert | 🟡 | 1行追加で効果大 |
| A11y | 2. aria-invalid | 🟡 | 1行追加で効果大 |
| A11y | 3. 固定横幅のレスポンシブ化 | 🟡 | 狭幅端末での破綻回避 |
| ドキュ | 1. 誕生日パスワード同期 | 🔴 | 本番運用上、パスワード仕様は最重要 |
| ドキュ | 2. 擬似メール変換 | 🟡 | 認証基盤の中核 |
| ドキュ | 3. 定期確認ロック | 🟡 | UX仕様不明のままはリスク |
| ドキュ | 4. TREE_PATHS 全量 | 🟢 | 参考資料性 |
| ドキュ | 5. Bare screen ルール | 🟢 | 次回の Bare screen 追加時に明文化でも可 |

---

## e. 次アクション候補（A/B/C 案）

### A案：🔴 をまとめて片付ける短期サイクル（推奨、0.5〜1d）
1. 誕生日同期の部分成功復帰フローを実装（pw更新失敗時にリトライボタン／`treeUser.birthday` の楽観反映を巻き戻す）
2. 誕生日パスワード同期の設計ドキュメントを `docs/specs/2026-04-24-tree-phase-b-beta-birthday-password.md` に新規作成
→ 本番投入前に潰しておくべき2点を一気に処理。

### B案：ドキュメント先行（0.25d、低リスク）
Phase B-β で新規に入った仕様（誕生日同期・擬似メール・bare screen）3点を spec 文書化。コードは触らない。
→ 次回コードレビュー時の文脈コストを下げることを優先。技術判断要素が少なく、a-auto 自律実行モードでも進められる候補。

### C案：アクセシビリティ+UIリファクタの束ね（1〜2d）
a11y 改善3点 + インラインstyle → Tailwind 段階移行をまとめて1PR に束ねる。
→ Tree 単独の UX 底上げ。ただし他モジュール実装と並行は衝突リスクあり。優先度としては A/B 後を推奨。

---

## 付録: 参考ファイル
- [login/page.tsx](C:/garden/a-tree/src/app/tree/login/page.tsx)
- [birthday/page.tsx](C:/garden/a-tree/src/app/tree/birthday/page.tsx)
- [TreeAuthGate.tsx](C:/garden/a-tree/src/app/tree/_components/TreeAuthGate.tsx)
- [layout.tsx](C:/garden/a-tree/src/app/tree/layout.tsx)

— end of review —
