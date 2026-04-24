# Garden-Forest テストケース案 — 2026-04-23（ブレスト）

**担当セッション**: a-forest（東海林A）
**発動モード**: 自律実行モード（就寝前）
**目的**: v9 レビュー課題 3「テストコードなし」への対応準備。
         現在テストは未整備（`__tests__/` ディレクトリなし、Playwright/Jest 未導入）。
         本ドキュメントはテスト整備時の出発点となるアイデア集。
**本ドキュメントは現時点で実装指示ではない**。東海林さん判断で優先度付きに整理される前提。

---

## 0. テスト環境の前提（まだ未整備）

Forest を対象にテストを書くにあたり、最低限必要なもの：

| 層 | ツール候補 | 備考 |
|---|---|---|
| ユニット（ロジック） | Vitest or Jest | Next.js App Router との相性は Vitest が良好 |
| コンポーネント | React Testing Library + jsdom | アクセシビリティ優先のクエリ |
| E2E | Playwright | Vercel プレビュー URL 対象にも実行可 |
| モック | MSW（Mock Service Worker） | Supabase クライアントの HTTP 層を差し替え |
| DB 前提 | Supabase ローカル（Docker）or `garden-dev` | **本番 garden-prod は禁止** |

> **重要**: CLAUDE.md の制約「新規 npm パッケージ追加は事前相談」に従い、
> 上記ツール群は導入前に東海林さんへ A案/B案 提示が必要。

---

## 1. ユニットテスト（純関数ロジック）

### 1-1 `_lib/format.ts` — 金額フォーマット
`fmtYen` / `fmtYenShort` は純関数で副作用なし。最も先に書くべき。

| # | ケース | 入力 | 期待値 | 境界 |
|---|---|---|---|---|
| U1-01 | 1 億ちょうど | 100_000_000 | `"1.0億"` | 億境界 |
| U1-02 | 1 億未満（1万以上） | 99_999_999 | `"10000万"` | 億未満の上限 |
| U1-03 | 1 万ちょうど | 10_000 | `"1万"` | 万境界 |
| U1-04 | 1 万未満 | 9_999 | `"9999円"` | 万未満 |
| U1-05 | 0 円 | 0 | `"0円"` | ゼロ |
| U1-06 | 負の値（億） | -150_000_000 | `"-1.5億"` | 赤字 |
| U1-07 | 負の値（万） | -50_000 | `"-5万"` | 赤字 |
| U1-08 | null | null | `"―"` | 欠損 |
| U1-09 | undefined | undefined | `"―"` | 欠損 |
| U1-10 | 小数入力 | 1_234_567.89 | `"123万"`（丸め） | 丸め挙動 |
| U1-11 | `fmtYenShort` 1 万未満 | 500 | `"500"`（円なし） | Short の違い |
| U1-12 | `fmtYenShort` null | null | `"―"` | 欠損 |

### 1-2 `_lib/auth.ts:toSyntheticEmail` — 社員番号 → 擬似メール
| # | ケース | 入力 | 期待値 |
|---|---|---|---|
| U2-01 | 1 桁 | `"8"` | `"emp0008@garden.internal"` |
| U2-02 | 4 桁 | `"1234"` | `"emp1234@garden.internal"` |
| U2-03 | 先頭ゼロ | `"0099"` | `"emp0099@garden.internal"` |
| U2-04 | 数字以外混入 | `"8abc"` | `"emp0008@garden.internal"` |
| U2-05 | 空文字 | `""` | `"emp0000@garden.internal"` |
| U2-06 | 5 桁（想定外） | `"12345"` | `"emp12345@garden.internal"`（padStart は伸ばさない） |

### 1-3 `_lib/auth.ts:isForestUnlocked` / `touchForestSession`
sessionStorage をモックして境界時刻テスト。
| # | ケース | 前提 | 期待値 |
|---|---|---|---|
| U3-01 | 未ロック | sessionStorage 未設定 | false |
| U3-02 | 1h 前ロック | Date.now() - 3600*1000 | true |
| U3-03 | ちょうど 2h 前 | Date.now() - 7200*1000 | false（厳密 `<` 比較） |
| U3-04 | 2h 1ms 前 | Date.now() - (7200*1000+1) | false |
| U3-05 | touchForestSession でリセット | 1h50m 前 → touch → 確認 | 新しい値に更新 |
| U3-06 | SSR（window なし） | typeof window === 'undefined' | false |

### 1-4 `_lib/mutations.ts:parseRange` — range 文字列 → ISO 日付
| # | ケース | 入力 | 期待値 |
|---|---|---|---|
| U4-01 | 通常 | `"2025/4~2026/3"` | `["2025-04-01","2026-03-31"]` |
| U4-02 | 月跨がない | `"2025/4~2025/6"` | `["2025-04-01","2025-06-30"]` |
| U4-03 | 12 月末 | `"2025/1~2025/12"` | `["2025-01-01","2025-12-31"]` |
| U4-04 | うるう年 2 月 | `"2024/2~2024/2"` | `["2024-02-01","2024-02-29"]` |
| U4-05 | 非うるう年 2 月 | `"2025/2~2025/2"` | `["2025-02-01","2025-02-28"]` |
| U4-06 | 不正形式 | `"2025年4月〜2026年3月"` | throws `parseRange: invalid format` |
| U4-07 | 区切りが `-` | `"2025/4-2026/3"` | throws |

### 1-5 `_lib/permissions.ts:isForestAdmin`
| # | ケース | 入力 | 期待値 |
|---|---|---|---|
| U5-01 | admin | `{ role: "admin" }` | true |
| U5-02 | viewer | `{ role: "viewer" }` | false |
| U5-03 | null | null | false |
| U5-04 | role 不明 | `{ role: "unknown" }` | false |

### 1-6 `/api/forest/parse-pdf/_lib/extract`
（`extract.ts` / `constants.ts` は未読だが、PDF 抽出ロジック。実 PDF をフィクスチャに）
| # | ケース | 期待 |
|---|---|---|
| U6-01 | 正常な残高試算表 PDF | uriage/gaichuhi/rieki/period すべて抽出 |
| U6-02 | 損益計算書のみ（外注なし） | gaichuhi=null、他は抽出 |
| U6-03 | 貸借対照表のみ（売上/外注/利益なし） | 全 null、period のみ抽出可能性 |
| U6-04 | 対応外 PDF | `isFinancialStatement` → false |
| U6-05 | 会社名が `COMPANY_MAP` 外 | company_id=null |
| U6-06 | 壊れた PDF | throws（route.ts 側で 500 変換） |

---

## 2. コンポーネントテスト（React Testing Library）

### 2-1 `<SummaryCards>`
| # | ケース | 期待 |
|---|---|---|
| C1-01 | 全法人にデータあり | 5 カード表示、合算値が正しい |
| C1-02 | 一部法人にデータなし | `countWithData` が減る、sub 表示正しい |
| C1-03 | 空配列 | 5 カード表示（全 0） |
| C1-04 | null 値を含む | 計算時に 0 扱い |

### 2-2 `<MicroGrid>`
| # | ケース | 期待 |
|---|---|---|
| C2-01 | 確定期のみ | 通常セル表示 |
| C2-02 | 進行期セル | ゴールドバッジ表示 |
| C2-03 | データ欠損年 | `"―"` 表示 |
| C2-04 | セルクリック（viewer） | DetailModal が開く |
| C2-05 | セルクリック（admin + 進行期） | onEditShinkouki 呼ばれる（モーダル切替） |
| C2-06 | グループ計 | 合算値が年度別に正しい |
| C2-07 | 法人 0 社 | グリッド非表示（null return） |
| C2-08 | 進行期のみで確定期なし | years min/max が進行期 yr に揃う |

### 2-3 `<ShinkoukiEditModal>`
| # | ケース | 期待 |
|---|---|---|
| C3-01 | 初期表示（📊 タブ） | 数値フォーム表示、minHeight 適用 |
| C3-02 | 🔄 タブ切替 | PeriodRolloverForm 表示、高さ維持 |
| C3-03 | Esc キー | onClose 呼ばれる |
| C3-04 | Ctrl+↓ | onNavigate(1) |
| C3-05 | Ctrl+↑ | onNavigate(-1) |
| C3-06 | 最初の法人で Ctrl+↑ | disabled（先頭ボタンは disabled） |
| C3-07 | 最後の法人で Ctrl+↓ | 次ボタンは disabled |
| C3-08 | 背景クリック | onClose |
| C3-09 | 内部クリック | stopPropagation（閉じない） |
| C3-10 | タブ切替ボタン aria | `aria-selected` や role |

### 2-4 `<NumberUpdateForm>`
| # | ケース | 期待 |
|---|---|---|
| C4-01 | 初期値表示 | initial から正しくプリフィル |
| C4-02 | 数字以外入力 | 自動削除（onChange で replace） |
| C4-03 | 空欄保存 | null として updateShinkouki に渡る |
| C4-04 | 負の値（赤字） | `-` 許容、保存可能 |
| C4-05 | PdfUploader 成功 | 抽出値でフォーム上書き |
| C4-06 | PdfUploader company_id 不一致 | エラー表示、フォーム変更なし |
| C4-07 | zantei ラジオ | クリックで切替 |
| C4-08 | 保存失敗 | error 表示、saving=false に戻る |
| C4-09 | キャンセル | onClose（保存しない） |
| C4-10 | 保存中の二重送信防止 | saving=true で disabled |

### 2-5 `<PeriodRolloverForm>`
| # | ケース | 期待 |
|---|---|---|
| C5-01 | 全項目入力 → 実行 | 確認ダイアログ表示 |
| C5-02 | 一部未入力 → 実行 | エラー表示、ダイアログ出ず |
| C5-03 | 確認ダイアログ「やめる」 | showConfirm=false、実行されず |
| C5-04 | 確認ダイアログ「実行」 | rolloverPeriod 呼ばれる |
| C5-05 | 実行失敗 | error 表示、saving=false |

### 2-6 `<PdfUploader>`
| # | ケース | 期待 |
|---|---|---|
| C6-01 | ドロップゾーンクリック | ファイル input トリガ |
| C6-02 | PDF ドロップ | uploadFile 呼ばれる |
| C6-03 | 非 PDF ドロップ | onError("PDF ファイルを選択してください") |
| C6-04 | ドラッグ中 | isDragging=true で見た目変化 |
| C6-05 | ドラッグリーブ | isDragging=false |
| C6-06 | アップロード中 | "📄 解析中..." 表示 |
| C6-07 | 未認証セッション | onError("セッションが取得できません...") |
| C6-08 | 401 レスポンス | onError に API エラー |

### 2-7 `<ForestGate>`
| # | ケース | 期待 |
|---|---|---|
| C7-01 | 初期表示 | 社員番号フィールドに autoFocus |
| C7-02 | 社員番号入力後 | パスワードフィールドに autoFocus |
| C7-03 | 数字以外入力 | 自動削除 |
| C7-04 | 4 桁超入力 | maxLength=4 で切られる |
| C7-05 | 空欄送信 | submit 無効 |
| C7-06 | signIn 失敗 | error 表示、login_failed ログ |
| C7-07 | signIn 成功 + 権限あり | refreshAuth 呼ばれる、login ログ |
| C7-08 | signIn 成功 + 権限なし | refreshAuth が error 返す、login_failed ログ |
| C7-09 | ログイン中ボタン | 「確認中...」表示、disabled |

### 2-8 `<DetailModal>`
| # | ケース | 期待 |
|---|---|---|
| C8-01 | 基本表示 | 6 行（売上/外注/利益/純資産/現金/預金）表示 |
| C8-02 | 経常利益マイナス | negative カラー適用 |
| C8-03 | doc_url あり | Drive リンク表示 |
| C8-04 | doc_url なし | リンク非表示 |
| C8-05 | Drive リンククリック | click_drive_link ログ |
| C8-06 | 進行期表示 | 「進行期」バッジ表示 |
| C8-07 | 閉じるボタン | onClose |

### 2-9 `<AccessDenied>`
| # | ケース | 期待 |
|---|---|---|
| C9-01 | 表示 | 🔒 アイコン + 見出し + 説明 |

### 2-10 `<ForestShell>`
| # | ケース | 期待 |
|---|---|---|
| C10-01 | `/forest/login` | ヘッダーなし（背景のみ） |
| C10-02 | `/forest/dashboard` （unlocked） | ヘッダー + ログアウトボタン表示 |
| C10-03 | dashboard（未 unlock） | ヘッダー非表示（main のみ） |
| C10-04 | ログアウトクリック | lockAndLogout("manual") 呼ばれる |

---

## 3. 統合テスト（Context + Routing）

### 3-1 `ForestStateContext` の挙動
| # | ケース | 期待 |
|---|---|---|
| I1-01 | 初期化（未認証） | loading→false、isAuthenticated=false |
| I1-02 | 初期化（認証あり/権限なし） | signOut 呼ばれる、isAuthenticated=false |
| I1-03 | 初期化（認証あり/権限あり/gate expired） | isUnlocked=false（ログイン画面へ） |
| I1-04 | 初期化（認証あり/権限あり/gate valid） | isUnlocked=true、データ fetch |
| I1-05 | refreshAuth 正常 | 全状態更新 + success=true |
| I1-06 | refreshAuth セッション切れ | 全クリア + success=false |
| I1-07 | refreshData 失敗 | console.error + 既存データ維持 |
| I1-08 | lockAndLogout("timeout") | logout_timeout ログ + 全クリア |
| I1-09 | セッションタイマー 2h 経過 | onTimeout → lockAndLogout |

### 3-2 ルーティング
| # | ケース | 期待 |
|---|---|---|
| I2-01 | `/forest` 未認証 | `/forest/login` リダイレクト |
| I2-02 | `/forest` unlocked | `/forest/dashboard` リダイレクト |
| I2-03 | `/forest/login` unlocked | `/forest/dashboard` リダイレクト |
| I2-04 | `/forest/dashboard` 未認証 | `/forest/login` リダイレクト |
| I2-05 | `/forest/dashboard` 認証済/権限なし | AccessDenied 表示 |

### 3-3 `rolloverPeriod` の整合性
| # | ケース | 期待 |
|---|---|---|
| I3-01 | INSERT + UPDATE 成功 | fiscal_periods に昇格 + shinkouki 次期化 |
| I3-02 | INSERT 失敗 | throws、shinkouki は変わらず |
| I3-03 | INSERT 成功 + UPDATE 失敗 | **DB 不整合**（ここが A-4 改善提案の根拠） |
| I3-04 | range が不正形式 | parseRange で throws、INSERT も走らず |

---

## 4. E2E テスト（Playwright、Vercel プレビュー対象）

### 4-1 正常フロー
| # | シナリオ | ステップ |
|---|---|---|
| E1-01 | ログイン → ダッシュボード | 社員番号+パスワード → ダッシュボード表示 → SummaryCards/MicroGrid 描画 |
| E1-02 | セル詳細閲覧（viewer） | 確定期セルクリック → DetailModal 開く → 閉じる |
| E1-03 | 進行期編集（admin） | 進行期セルクリック → ShinkoukiEditModal 開く → 📊 数値編集 → 保存 → MicroGrid 更新 |
| E1-04 | PDF アップロード（admin） | モーダル内 PDF ドロップ → 抽出値プリフィル → 保存 |
| E1-05 | 期切り替え（admin） | 🔄 タブ → 入力 → 確認 → 実行 → 次期が進行期に |
| E1-06 | 手動ログアウト | ログアウトボタン → ログイン画面 |

### 4-2 異常系
| # | シナリオ | ステップ |
|---|---|---|
| E2-01 | 社員番号/パスワード誤り | エラー表示、ダッシュボード遷移なし |
| E2-02 | forest_users 未登録ユーザー | エラー表示 + 強制ログアウト |
| E2-03 | セッション 2h タイムアウト | 自動ログアウト → ログイン画面 |
| E2-04 | viewer で進行期セルクリック | DetailModal に落ちる（編集モーダルは出ない） |
| E2-05 | viewer が `/api/forest/parse-pdf` 直叩き | 403 Forbidden |
| E2-06 | 非 PDF アップロード | エラー表示 |
| E2-07 | 期切り替え確認ダイアログで「やめる」 | rollover 実行されず |

### 4-3 アクセシビリティ系（B-1, B-2, B-10 対応）
| # | シナリオ | 確認 |
|---|---|---|
| E3-01 | Tab キーでダッシュボードを巡回 | 全インタラクティブ要素に到達可能 |
| E3-02 | モーダル内で Tab 循環 | 背景要素に移動しない（要 B-1 実装） |
| E3-03 | Enter/Space でセルが開く | 要 B-2 実装 |
| E3-04 | PdfUploader に TAB で到達 | 要 B-10 実装 |
| E3-05 | axe-core スキャン | 各ページで critical 違反 0 件 |

### 4-4 レスポンシブ
| # | 画面幅 | 確認 |
|---|---|---|
| E4-01 | 1920px（PC） | MicroGrid 全幅表示、SummaryCards 5 列 |
| E4-02 | 1024px（タブレット） | SummaryCards 3–4 列、MicroGrid 横スクロール |
| E4-03 | 768px | SummaryCards 2 列 |
| E4-04 | 375px（モバイル） | 全体が縦展開、ヘッダー崩れなし |

---

## 5. セキュリティテスト（RLS / API）

### 5-1 RLS ポリシー（Supabase DB）
| # | ケース | 期待 |
|---|---|---|
| S1-01 | anon が companies SELECT | 0 行 |
| S1-02 | viewer が companies SELECT | 全件 |
| S1-03 | viewer が shinkouki UPDATE | blocked |
| S1-04 | admin が shinkouki UPDATE | 成功 |
| S1-05 | admin が fiscal_periods INSERT | 成功 |
| S1-06 | viewer が fiscal_periods INSERT | blocked |
| S1-07 | anon が forest_audit_log INSERT（login_failed） | 成功 |
| S1-08 | anon が forest_audit_log INSERT（他 action） | blocked |
| S1-09 | viewer が forest_users SELECT（自分） | 成功 |
| S1-10 | viewer が forest_users SELECT（他人） | blocked |

### 5-2 API（/api/forest/parse-pdf）
| # | ケース | 期待ステータス |
|---|---|---|
| S2-01 | Authorization ヘッダなし | 401 |
| S2-02 | 不正 JWT | 401 |
| S2-03 | viewer JWT | 403 |
| S2-04 | admin JWT + PDF 無 | 400 |
| S2-05 | admin JWT + 非財務 PDF | 400 |
| S2-06 | admin JWT + 正常 PDF | 200 + data |
| S2-07 | admin JWT + 壊れた PDF | 500 |
| S2-08 | CORS（外部サイトから） | ブロック（Next.js デフォルト） |

---

## 6. リグレッション候補（実装済みバグの再発防止）

過去に修正済みのバグは、リグレッションテストを書いておくと再発を防げる。

| # | 過去の修正 | テスト化の案 |
|---|---|---|
| R-01 | JWT タイミング問題（refreshAuth 分離） | signInForest 直後に forest_users SELECT しない |
| R-02 | タブ切替時の高さジャンプ（PR #11） | 📊 ⇔ 🔄 タブ切替前後でモーダル外枠の高さが不変 |
| R-03 | ログイン画面 input の文字色（dd8a48f） | `color` 値のスタイルスナップショット |
| R-04 | 社員番号プレフィル削除（dd8a48f） | 初期表示時に empId が空 |

---

## 7. 非目標（今回のテストに含めない）

- パフォーマンステスト（負荷試験）
- ビジュアルリグレッション（Chromatic 等）
- モバイルネイティブアプリ（Forest は Web のみ）
- 自動 SQL インジェクション検査（RLS + Supabase パラメタライズドで防御済み前提）

---

## 8. 実装順の提案（A案/B案/C案）

- **A案（最小セット）**: 1 章（純関数ユニット）+ 5 章の S1（RLS）だけ。
  見積: 0.5d。パッケージ追加最小（Vitest のみ）
- **B案（推奨セット）**: 1 章 + 2 章（コンポーネント） + 5 章 S1/S2。
  見積: 1.5d〜2d。RTL + MSW 追加
- **C案（フルセット）**: A〜6 章全部。Playwright 含む E2E まで。
  見積: 3d〜5d。Vercel プレビュー対象の CI 設定も必要

---

**ブレスト完了**: 本ドキュメントは「テスト整備開始のたたき台」。
実装着手時に東海林さん判断で優先度と範囲が決まる前提。
