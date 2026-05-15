# 仕訳帳機能 Garden 化（暫定 Forest 配置）

> **配置原則**: 暫定 Forest 配下、将来（5/17 以降）に `src/app/bud/shiwakechou/` へ移行。  
> Forest コアパッケージ (`src/app/forest/_components`, `_lib`, `_state`) への依存禁止 — Bud 移行時の機械的移植を保証。

## 5/6 朝着手予定の構造

```
src/app/forest/shiwakechou/
├── page.tsx                           # 仕訳帳トップ（6 法人カード一覧）
├── [corp_id]/
│   ├── page.tsx                       # 法人ダッシュボード
│   ├── bk/page.tsx                    # 銀行明細処理
│   ├── balance/page.tsx               # （Q4 後追い、Phase 2）
│   └── exports/page.tsx               # 弥生エクスポート履歴
├── balance-overview/page.tsx          # Q4 全法人横断（後道さん向け）
└── master/page.tsx                    # 共通マスタ管理（Phase 2）
```

## 関連ドキュメント

- spec: `docs/superpowers/specs/2026-04-26-shiwakechou-bud-migration-design.md`
- handoff: `docs/handoff-forest-202605052235.md`
- forest-7 dispatch: `docs/dispatch-forest-7-final-go-yayoi-a-receive-20260505.md`

## DB

`bud_*` プレフィックス（Bud 移行時もテーブル名を変えずに済む）。

`supabase/migrations/20260506_*_bud_shiwakechou_*.sql` を 5/6 朝に作成。

## 認証

- B-min: `forest_users.role IN ('admin', 'executive')` 流用
- Bud 移行時: `bud_users.role` ベースに切替
