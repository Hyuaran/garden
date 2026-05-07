# Leaf 関電業務委託 A-1c Phase A Backoffice UI 着手前 準備ガイド

> 起草: a-leaf-002
> 起草日時: 2026-05-07(木) 19:50
> 用途: Phase A Backoffice UI（9 task、2.3d 見積）着手前の前提条件 / 工程 / skeleton / 認証導線方針を 1 ファイルに集約
> 関連: spec v3.2 / plan v3.2（PR #130）/ 認証導線方針（`leaf-phase-a-auth-policy-20260507.md`）

---

## 1. 概要

Phase A は Leaf 関電業務委託 A-1c（添付ファイル機能）の Backoffice UI 実装フェーズ。Phase D 共通基盤（migration / supabase client / types / kanden-storage-paths / leaf-supabase-mock / image-compression / attachments.ts / role-context）が develop merge された後に着手する。

合計 9 task、見積 2.3d。すべて Vitest + RTL + MSW でテスト先行（TDD）。

## 2. 着手前提条件チェックリスト

着手判断時に以下が **すべて ✅** になっているか確認：

| # | 前提条件 | 現状（2026-05-07 時点） | 確認方法 |
|---|---|---|---|
| 1 | PR #65（Task D.1 migration SQL）develop merge 済 | 🟡 a-bloom レビュー待ち | `gh pr view 65 --json state` |
| 2 | PR #66（Task D.2 supabase client）develop merge 済 | 🟡 a-bloom レビュー待ち | `gh pr view 66` |
| 3 | PR #67（Task D.3 types）develop merge 済 | 🟡 a-bloom レビュー待ち | `gh pr view 67` |
| 4 | PR #68（Task D.4 kanden-storage-paths）develop merge 済 | 🟡 a-bloom レビュー待ち | `gh pr view 68` |
| 5 | PR #69（Task D.5 leaf-supabase-mock）develop merge 済 | 🟡 a-bloom レビュー待ち | `gh pr view 69` |
| 6 | PR #70（Task D.6+D.7 image-compression）develop merge 済 | 🟡 a-bloom レビュー待ち | `gh pr view 70` |
| 7 | PR #72（Task D.8〜D.13 attachments.ts）develop merge 済 | 🟡 a-bloom レビュー待ち | `gh pr view 72` |
| 8 | PR #73（Task D.12 role-context）develop merge 済 | 🟡 a-bloom レビュー待ち | `gh pr view 73` |
| 9 | PR #130（spec/plan v3.2 改訂）develop merge 済 | 🟡 a-bloom レビュー待ち | `gh pr view 130` |
| 10 | Garden 統一認証 `/login` 完成（a-bloom-004 + a-root-002）| 🟡 5/13 完成見込み | 横断 dispatch main- No. 83 / No. 85 |
| 11 | migration `scripts/leaf-schema-patch-a1c.sql` 本番実行済 | ❌ 未実行 | Supabase Dashboard 確認 |
| 12 | npm package `heic2any` install 済（v3.2 で bcryptjs は不要化）| ❌ 未 install | `package.json` 確認 |
| 13 | テスト基盤（vitest / RTL / MSW / happy-dom）install 済 | ❌ 未 install | `package.json` 確認 |
| 14 | `leaf_businesses('kanden')` + 東海林さん super_admin 所属 行 投入済 | ❌ migration 後実施 | Supabase Dashboard SQL 確認 |
| 15 | `root_settings.leaf.image_download_password_hash` 仮 PW 投入済 | ❌ migration 後実施 | Supabase Dashboard SQL 確認 |

→ #1-#10 は他者（a-bloom レビューア / a-bloom-004 / a-root-002）の作業待ち。#11-#15 は東海林さん作業（npm install / Dashboard SQL 実行）。

---

## 3. 9 task 一覧 + test plan サマリ

| # | Task | 対象 Component / Page | 主要 props / 機能 | 主要 RTL 検証 | 工数 | 関連 plan 行 |
|---|---|---|---|---|---|---|
| A.1 | `AttachmentCard.tsx` | サムネ + メタ + ホバー × ボタン | `attachmentId` / `thumbnailSignedUrl` / `category` / `onClick` / `onDelete` | 表示 / クリック / 削除済バッジ表示 | 0.2d | 2382-2493 |
| A.2 | `AttachmentLightbox.tsx` | 1500px 拡大ビューワ | `attachmentId` / `signedUrl` / `onClose` / `onPrev` / `onNext` | 表示 / ESC・背景 close / ← → 遷移 / Tab フォーカス | 0.3d | 2494-2611 |
| A.3 | `AttachmentDeleteButton.tsx`（v3.2: 全員表示）| 削除ボタン（楽観的更新 + UNDO 5 秒）| `attachmentId` / `onDeleted` | 全ロール × 表示 / 2 段確認 / UNDO snackbar / 5 秒経過 | 0.25d | 2612-2759 |
| A.3b | `DownloadButton.tsx`（v3.2: DL 専用 PW RPC 検証）| PC 即 DL / モバイル PW モーダル | `attachmentId` / `signedUrl` | PC 即 DL / モバイル モーダル / RPC `verify_image_download_password` 呼出 / 3 回失敗ロック | 0.3d | 2760-2936 |
| A.3c | `AttachmentAdminActions.tsx` | admin+ 限定 復元/物理削除 | `attachmentId` / `deletedAt` / `onRestored` / `onHardDeleted` | admin+ のみ表示 / 強い確認 / Storage remove 連動 | 0.25d | 2937-3087 |
| A.4 | `AttachmentGrid.tsx`（最重要、UNDO snackbar 統合）| カテゴリ別タブ + サムネ一覧 + 削除済分類 | `caseId` | カテゴリ別表示 / signedURL 一括発行 / TTL 切れ再発行 / loading・error・empty / **全ロール × + AdminActions admin+ のみ** / UNDO snackbar | 0.5d | 3088-3301 |
| A.5 | `AttachmentUploader.tsx` | PC 向け drag&drop + file input | `caseId` / `category` / `onUploaded` | File drop + input / カテゴリ必須 / HEIC 変換 / Canvas 圧縮 / 並列進捗 / beforeunload | 0.4d | 3302-3466 |
| A.6 | Backoffice `page.tsx` 組込 | RoleProvider + AttachmentGrid + Uploader | - | 案件選択 → 添付セクション表示 → upload → 表示 → 削除 一連の目視確認 | 0.1d | 3467-3548 |
| A.7 | Root マイページ DL PW 設定 UI（v3.2: 平文 PW 直送）| `PasswordSetForm.tsx` + page.tsx | - | super_admin 判定 / 新旧 PW 一致 / RPC `set_image_download_password({ new_password })` 呼出 | 0.3d | 3549-3750 |
| | **合計** | | | | **2.6d**（簡略化で 2.3d 想定）| |

> 詳細 test コード / 実装コードは plan v3.2（`docs/superpowers/plans/2026-04-25-leaf-a1c-attachment.md`）の各 Task セクション参照。本ガイドはサマリ版。

---

## 4. Component skeleton 全体像

### 4.1 ディレクトリ構造（実装後）

```
src/app/leaf/backoffice/
├─ page.tsx                          # Task A.6 組込（既存 + RoleProvider 追加）
└─ _components/
   ├─ AttachmentCard.tsx             # Task A.1
   ├─ AttachmentGrid.tsx             # Task A.4（中核）
   ├─ AttachmentLightbox.tsx         # Task A.2
   ├─ AttachmentDeleteButton.tsx     # Task A.3
   ├─ DownloadButton.tsx             # Task A.3b
   ├─ AttachmentAdminActions.tsx     # Task A.3c
   ├─ AttachmentUploader.tsx         # Task A.5
   └─ __tests__/
      ├─ AttachmentCard.test.tsx
      ├─ AttachmentGrid.test.tsx
      ├─ AttachmentLightbox.test.tsx
      ├─ AttachmentDeleteButton.test.tsx
      ├─ DownloadButton.test.tsx
      ├─ AttachmentAdminActions.test.tsx
      └─ AttachmentUploader.test.tsx

src/app/root/me/image-download-password/
├─ page.tsx                          # Task A.7（super_admin 限定ページ）
└─ _components/
   ├─ PasswordSetForm.tsx            # Task A.7（フォーム本体）
   └─ __tests__/
      └─ PasswordSetForm.test.tsx
```

### 4.2 依存関係グラフ（実装順序の参考）

```
A.1 AttachmentCard ─┐
                    ├─→ A.4 AttachmentGrid (中核)
A.2 AttachmentLightbox ─┐                       │
                        │                       ↓
A.3 DeleteButton ───────┼──→ AttachmentGrid ─→ A.6 Backoffice page
                        │                       ↑
A.3b DownloadButton ────┤                       │
                        │                       │
A.3c AdminActions ──────┘  A.5 Uploader ────────┘

A.7 PasswordSetForm（独立、Root 配下）
```

→ A.1 → A.2 → A.3 → A.3b → A.3c → A.5 → A.4（A.1〜A.5 を組合せ）→ A.6（page 組込）→ A.7（独立、並行可）

---

## 5. 認証統一方針（B 案、main- No. 85 承認済）の Phase A 反映点

詳細は `docs/leaf-phase-a-auth-policy-20260507.md` 参照。Phase A 着手時に以下を遵守：

| 項目 | 反映方針 |
|---|---|
| `/leaf/login/page.tsx` の新設 | ❌ **新設しない**（Garden Series 統一認証 `/login` を使用、main- No. 83 承認済） |
| LeafGate（専用 Gate コンポ） | ❌ **新設しない**（Backoffice page.tsx 内で未ログイン判定 → `/login` redirect） |
| `_lib/auth.ts` の signInLeaf | 🟡 **当面残置**（共通化は a-root-002 担当、勝手に削除しない）|
| Backoffice page.tsx の lock screen | 🟡 **Phase A 設計時に判断**（A 維持 / B `/login` redirect 移行） |
| legacy 保持（route.legacy-leaf-*）| ❌ **不要**（develop 上に旧版なし） |
| Root マイページ DL PW 設定 UI（A.7）| 🟢 super_admin 判定は `useGardenRole()` で実装、認証導線は `/login` 経由想定 |

---

## 6. v3.2 改訂による Phase A 影響点

PR #130 で確定した v3.2 改訂が Phase A に与える影響：

| Task | v3 → v3.2 変更点 | 対応 |
|---|---|---|
| A.3b DownloadButton | DL 専用 PW RPC 内部実装が search_path 修正版に | RTL mock は変更不要（API 表面同じ）|
| A.7 PasswordSetForm | bcryptjs client hash → 平文 PW 直送 | テスト mock 削除 + 実装 import 削除（plan v3.2 反映済）|
| Task 0.1 npm 承認 | 10 → 8 パッケージ（bcryptjs 系除外）| 着手時の承認依頼を 8 個で起票 |
| Task 0.2 npm install | bcryptjs install 不要 | install コマンドから除外 |

---

## 7. 着手判断ポイント

着手 GO / 待機 を判断する分岐：

```
Phase A 着手 GO 判定フロー

[Step 1] PR #65〜#73 + #130 すべて develop merge 済？
   YES → [Step 2]
   NO → 待機（a-bloom レビュー進捗確認、必要なら催促）

[Step 2] migration scripts/leaf-schema-patch-a1c.sql 本番実行済？
   YES → [Step 3]
   NO → 東海林さんに Dashboard 実行依頼

[Step 3] npm install heic2any + テスト基盤 7 個 完了？
   YES → [Step 4]
   NO → 東海林さんに別 PowerShell で install 依頼
        npm install heic2any@^0.0.4
        npm install -D vitest@^1.6.0 @vitejs/plugin-react@^4.3.1 \
                       @testing-library/react@^16.0.0 @testing-library/user-event@^14.5.2 \
                       @testing-library/jest-dom@^6.4.8 msw@^2.3.0 happy-dom@^14.12.0

[Step 4] Garden 統一 /login 完成（a-bloom-004 + a-root-002）？
   YES → [Step 5]
   NO → 待機（5/13 完成見込み、認証導線が確定するまで A.6 page.tsx 組込は最終調整）
        ※ A.1〜A.5 / A.7 は /login 完成前でも実装着手可能（B 案で最初から redirect 仕様で書く）

[Step 5] 着手 GO → A.1 から TDD で順次実装
   推奨順: A.1 → A.2 → A.3 → A.3b → A.3c → A.5 → A.4 → A.6 → A.7
   各 Task で Vitest test 先行 → FAIL → 実装 → PASS → commit → push → 次 Task
```

---

## 8. 関連資料リンク

- spec v3.2: `docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md`（PR #130）
- plan v3.2: `docs/superpowers/plans/2026-04-25-leaf-a1c-attachment.md`（PR #130）
- 認証導線方針: `docs/leaf-phase-a-auth-policy-20260507.md`
- 横断 dispatch: `C:\garden\a-main-013\docs\dispatch-main-no83-garden-unified-auth-gate-20260507.md`
- B 案承認: `C:\garden\a-main-013\docs\dispatch-main-no85-leaf-b-plan-approval-20260507.md`
- 全前倒し dispatch: `C:\garden\a-main-013\docs\dispatch-main-no86-all-modules-full-acceleration-20260507.md`
- claude.ai 起草版 UI（Garden Series）: `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-ui-concept\`

---

## 9. 改訂履歴

| 日付 | 版 | 内容 | 担当 |
|---|---|---|---|
| 2026-05-07 | v1.0 | 初版起草、a-main-013 main- No. 86 全前倒し dispatch 対応、# 2 Phase A UI test plan + skeleton 整理 として作成 | a-leaf-002 |

— end of prep guide —
