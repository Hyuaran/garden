# Spec Issue: 横断 ログイン画面整合性

- 起票: 2026-04-26 a-bloom（緊急 returnTo 修正の副産物）
- 関連 PR: feat(bloom): 独立 login 画面 + returnTo バグ修正

## 背景

a-bloom の `/bloom/login` 新設・`/forest/login` の returnTo バグ修正に伴い、他モジュールの login 画面挙動を点検したところ以下の不整合・欠如を確認。a-main / 各モジュール担当へ後追い対応の参考として記録。

## 調査結果（2026-04-26 時点）

| モジュール | login 画面 | returnTo 対応 | 備考 |
|---|---|:-:|---|
| **forest** | /forest/login | ✅ 本 PR で修正 | sanitizeForestReturnTo 同一オリジン path のみ許可 |
| **bloom** | /bloom/login | ✅ 本 PR で新設 | sanitizeReturnTo /bloom prefix のみ許可 |
| **root** | /root/login | ✅ 既存 | sessionStorage 経由 popReturnTo() パターン |
| **tree** | /tree/login | ❌ 不足 | `TREE_PATHS.DASHBOARD` ハードコード（旧 Forest 同型のバグ） |
| **bud** | — | — | login 画面が存在しない |
| **leaf** | — | — | login 画面が存在しない |
| **soil / rill / seed** | — | — | モジュール自体未実装 |

## 推奨アクション（後日、別 PR）

### Tree（優先度: 🟡 中）
- `src/app/tree/login/page.tsx` の `router.replace(TREE_PATHS.DASHBOARD)` / `router.push(TREE_PATHS.DASHBOARD)` を `useSearchParams` + sanitize 関数で returnTo 対応に
- 修正パターンは本 PR の `sanitizeForestReturnTo` を流用可
- 担当: a-tree
- 工数想定: 0.1d

### Bud / Leaf（優先度: 🟢 低）
- 現状 login 画面なし → /forest/login or /root/login 経由でログインしている想定
- 各モジュール独自のブランドカラー login 画面が必要なら新設（cross-ui spec PR #36 のブランドカラー定義あり: Bud `#E07A9B` / Leaf `#7FC66D`）
- ただし設計判断要：単独 login が必要か否かは a-main / 東海林さん判断
- 担当: a-bud / a-leaf
- 工数想定: 各 0.25-0.5d

## セキュリティ観点（共通方針）

returnTo を扱う全 login 画面で以下を必須とする（本 PR で Bloom / Forest で確立）：

- **絶対 URL（http://, https://）拒否**
- **プロトコル相対 URL（//host/...）拒否**
- **`/` 始まりの path 限定**
- **javascript: などのスキーム拒否**（slash チェックで自動的に拒否される）
- 必要に応じて **モジュール固有 prefix チェック**（Bloom は `/bloom` 以下のみ許可）

これらは XSS / Open Redirect 防止の最低ライン。

## 完了基準（後追い PR）

- [ ] /tree/login が returnTo 対応 + sanitize 実装
- [ ] /bud/login の要否を a-main 経由で東海林さんに確認
- [ ] /leaf/login の要否を a-main 経由で東海林さんに確認
- [ ] cross-ui spec に「全モジュール login 画面共通仕様（returnTo + sanitize）」セクション追加検討
