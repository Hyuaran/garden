# Leaf 関電業務委託 Phase C-05: Chatwork 通知設計（案 D: 署名 URL 不流通）

- 対象: Leaf 関電業務委託の Chatwork 通知全般
- 優先度: **🟡 中**
- 見積: **0.5d**
- 担当セッション: a-leaf
- 作成: 2026-04-24（a-auto / Batch 8 Leaf 関電 #05）
- 前提: spec-cross-chatwork（Batch 7）, C-04（Cron 処理）, project_chatwork_bot_ownership memory

---

## 1. 目的とスコープ

### 目的
Leaf 関電業務委託の**月次・週次・イベント駆動**の通知を、**案 D（署名 URL 不流通、Garden ログイン誘導）**方式で Chatwork に配信する。幹部組ルーム限定 + 「【事務局】システム自動通知」Bot 経由で機密性を確保。

### 含める
- Chatwork 通知テンプレ 6 種（月次レポート / PD 同期結果 / 滞留リマインダ / 解約 / 手数料異常 / 至急 SW 検出）
- ルーム振分ルール（幹部組 / 事務 / 個別 DM）
- **案 D**: 署名 URL を本文に貼らず、Garden ログイン URL 誘導
- Bot アカウント運用ガイド（project_chatwork_bot_ownership 準拠）
- dry-run / staging / 本番の段階リリース（spec-cross-chatwork §5.3 準拠）

### 含めない
- Chatwork クライアント実装（`src/lib/chatwork/` 既設）
- ルーム作成自体（東海林さん + a-main 運用）
- Webhook 受信（Phase D）

---

## 2. 通知の全体設計

### 2.1 通知トリガ一覧

| # | イベント | トリガ元 | 通知先 | 頻度 |
|---|---|---|---|---|
| 1 | **月次関電報告書完成** | C-04 monthly-report Cron | 幹部組ルーム | 毎月 2 日 03:30 JST |
| 2 | **PD 同期差分検出** | C-04 pd-sync Cron | 事務ルーム | 毎日 05:30 JST（差分あり時のみ）|
| 3 | **滞留リマインダ** | C-04 status-reminder Cron | 事務ルーム | 週次月曜 09:00 JST |
| 4 | **案件解約** | C-02 cancelCase Server Action | 幹部組ルーム | 即時 |
| 5 | **手数料異常検出** | C-04 commission-calc Trigger | 幹部組 DM（東海林さん）| 即時 |
| 6 | **至急 SW（S5 等）検出** | C-03 OCR 結果 | 事務ルーム + 営業 DM | 即時 |

### 2.2 ルーム設計

```
# Chatwork ルーム（既存 or 新規作成）
- 幹部組ルーム（既存、admin 以上のみ）
- Leaf 事務ルーム（新規作成、staff+ 向け）
- 個別 DM（root_employees.chatwork_dm_room_id）
```

### 2.3 環境変数（spec-cross-chatwork §3.2 準拠）

```bash
CHATWORK_ROOM_LEAF_KANDEN_ADMIN=12345682    # 幹部組ルーム
CHATWORK_ROOM_LEAF_KANDEN_OFFICE=12345683   # Leaf 事務ルーム
# 個別 DM は root_employees.chatwork_dm_room_id で解決
```

---

## 3. 案 D: 署名 URL 不流通方式

### 3.1 背景

- 月次レポート PDF / CSV を Chatwork に**直接添付 or 署名 URL**で流すと、**URL 漏洩時の被害範囲が Chatwork 範囲外に広がる**
- 案 D は**本文に URL を貼らない**、代わりに **Garden のログイン画面 URL** を貼り、Garden 内で認証した上で閲覧させる

### 3.2 案 D の実装パターン

```typescript
// ❌ 案 A（避ける）: 署名 URL を本文に貼る
const signedUrl = await admin.storage.from('leaf-monthly-reports').createSignedUrl(path, 3 * 24 * 3600);
await client.sendMessage(roomId, `レポートはこちら: ${signedUrl}`);

// ✅ 案 D（推奨）: Garden の案件一覧 URL のみ
await client.sendMessage(roomId, `
[info][title]📊 2026-04 月次関電報告書が完成しました[/title]
集計件数: 完了 42 件 / 解約 3 件
売上合計: ¥2,450,000

詳細は Garden でご確認ください:
https://garden.hyuaran.com/leaf/backoffice/monthly-reports/2026-04

※ Garden にログイン後に閲覧してください（Chatwork 内の URL は認証されません）
[/info]
`);
```

### 3.3 Garden 側の対応

- `/leaf/backoffice/monthly-reports/[month]/page.tsx` 新規作成（C-02 の拡張）
- ログイン必須、`leaf_is_office()` で RLS 制御
- 画面内で「PDF DL」ボタン → 都度 10 分有効の signedURL 発行
- **Chatwork 外の URL は一切発行しない**

### 3.4 メリット

- URL 漏洩の被害範囲を Garden 内に閉じる
- 閲覧ログが Garden 側で取れる（`root_audit_log`）
- Chatwork に機密データが残らない

---

## 4. Bot アカウント運用（project_chatwork_bot_ownership 準拠）

### 4.1 Bot アカウント方針

- **「【事務局】システム自動通知」アカウント**を Chatwork 側に新規作成（東海林さん実施）
- API トークンは東海林さんが所有、Vercel `CHATWORK_API_TOKEN` 環境変数に格納
- Bot は**参加ルームを最小限**に：幹部組 + Leaf 事務 + 一部個別 DM（必要時）
- Bot からの投稿は**すべて `[info][title]` で装飾**、視覚的に Bot 発信と識別可能

### 4.2 Bot 投稿の識別ルール

```
[info][title]<icon> <module> <title>[/title]
(本文)

🔗 <Garden URL>
[/info]
```

- 本文冒頭が `[info][title]` なら Bot 発信
- 本文に`※ このメッセージは自動配信です` のフッター併記（誤返信防止）

### 4.3 Bot アクセス権限

- Chatwork 側で Bot を **readOnly** にはできない → **投稿可能**だが、**返信・メンション処理は無視**
- 将来 Webhook 受信で Bot 宛 `@』 メンションに応答（Phase D、社内問合せ対応）

---

## 5. 通知テンプレート 6 種

### 5.1 月次関電報告書完成（§2.1 #1）

```
[info][title]📊 2026-04 月次関電報告書 完成[/title]
集計件数: 完了 42 件 / 解約 3 件 / 滞留 5 件
売上合計: ¥2,450,000
実行: 2026-05-02 03:15（所要 3 分）

詳細は Garden でご確認ください:
https://garden.hyuaran.com/leaf/backoffice/monthly-reports/2026-04

※ Garden にログイン後に閲覧してください
※ このメッセージは自動配信です
[/info]
```

### 5.2 PD 同期差分検出（§2.1 #2）

```
[info][title]⚠️ PD 同期差分 3 件[/title]
対象: 2026-04-25
差分タイプ:
• status_ahead: 1 件（PD 側が先行）
• pd_not_found: 2 件（PD 側に該当なし）

詳細・解消は Garden でご確認ください:
https://garden.hyuaran.com/leaf/backoffice?pd_errors=true

※ このメッセージは自動配信です
[/info]
```

### 5.3 滞留リマインダ（§2.1 #3）

```
[info][title]📌 滞留案件 5 件（2026-04-28 週次）[/title]
14 日以上進行していない案件:

• K-20260401-0042（諸元待ち / 15日）担当: 田中
• K-20260405-0018（エントリー待ち / 19日）担当: 鈴木
• K-20260403-0025（送付待ち / 22日）担当: 佐藤
• K-20260402-0031（請求待ち / 17日）担当: 田中
• K-20260401-0009（入金待ち / 14日）担当: 鈴木

詳細・進行は Garden でご確認ください:
https://garden.hyuaran.com/leaf/backoffice?stuck=true

※ このメッセージは自動配信です
[/info]
```

### 5.4 案件解約（§2.1 #4）

```
[info][title]🟥 案件解約: K-20260401-0042[/title]
顧客: 山田商店
契約: 高圧 HV-BIZ-1
解約日: 2026-04-25
理由: 顧客都合（契約更新を見送り）
担当: 田中太郎

詳細:
https://garden.hyuaran.com/leaf/backoffice/cases/K-20260401-0042

※ このメッセージは自動配信です
[/info]
```

### 5.5 手数料異常検出（§2.1 #5）

```
[info][title]🚨 手数料異常検出: K-20260410-0077[/title]
検出内容: 手数料率 15.0%（標準 5-10%）
対象: 高橋工業（高圧）
計算額: ¥780,000

ご確認をお願いします:
https://garden.hyuaran.com/leaf/backoffice/cases/K-20260410-0077

※ このメッセージは自動配信です（東海林さん宛 DM）
[/info]
```

### 5.6 至急 SW 検出（§2.1 #6）

```
[info][title]🔥 至急 SW 案件検出: K-20260425-0003[/title]
顧客: 緊急商事
SW 希望月: 2026-05（S5）
OCR 信頼度: 94%
担当営業: 鈴木花子

諸元回収を至急お願いします:
https://garden.hyuaran.com/leaf/backoffice/cases/K-20260425-0003

※ このメッセージは自動配信です
[/info]
```

---

## 6. 配信ロジック

### 6.1 配信関数（spec-cross-chatwork 準拠）

```typescript
// src/lib/leaf/notifications.ts
import { createChatworkClient } from '@/lib/chatwork/client';
import { CHATWORK_ROOMS, resolveDmRoomForEmployee } from '@/lib/chatwork/rooms';
import { assertDmRoom } from '@/lib/chatwork/preview';

export async function notifyMonthlyReport(input: {
  targetMonth: string;
  summary: MonthlyReportSummary;
}) {
  const client = createChatworkClient();
  const body = buildMonthlyReportTemplate(input);
  await client.sendMessage(CHATWORK_ROOMS.leafKandenAdmin(), body);
}

export async function notifyCancellation(input: { caseRecord: KandenCase; reason: string }) {
  const client = createChatworkClient();
  const body = buildCancellationTemplate(input);
  await client.sendMessage(CHATWORK_ROOMS.leafKandenAdmin(), body);
}

export async function notifyCommissionAnomaly(input: { caseRecord: KandenCase; reason: string }) {
  const supabase = createAdminSupabase();
  const dmRoom = await resolveDmRoomForEmployee(supabase, /* 東海林さんの employee_id */);
  if (!dmRoom) {
    console.warn('[leaf] tokaibayashi DM room not configured');
    return;
  }
  const client = createChatworkClient();
  await assertDmRoom(client, dmRoom);   // DM 強制
  await client.sendMessage(dmRoom, buildCommissionAnomalyTemplate(input));
}

// ... 他 3 種
```

### 6.2 dry-run 環境での挙動

spec-cross-chatwork §5.2 準拠：
- Local dev / Preview: `CHATWORK_DRY_RUN=true` で Console ログのみ
- Staging: `[TEST]` プレフィックス付きテストルームへ送信
- Production: 本番ルームへ送信

### 6.3 エラーハンドリング

- 429 レート制限: 指数バックオフ 3 回
- 404 ルーム不存在: `console.error` + `root_audit_log` に critical 記録、運用に通知
- トークン無効: 即 admin アラート

---

## 7. 段階リリース

spec-cross-chatwork §5.3 準拠：

### 段階 1: dry-run（M3 第 1 週）
- `CHATWORK_DRY_RUN=true` で Console 出力
- 6 種テンプレの文面レビュー

### 段階 2: staging 疎通（M3 第 2 週）
- テストルーム `[TEST] Garden Leaf 通知` で疎通確認
- 2-3 日観察

### 段階 3: 本番 1 ルーム先行（M3 第 3 週）
- **幹部組ルーム**のみ本番投入（月次レポート + 解約通知のみ）
- 7 日間観察、誤送信ゼロを確認

### 段階 4: 本番全配信（M3 末）
- 全 6 種を本番投入

---

## 8. 監査ログ連携（spec-cross-audit-log 準拠）

```typescript
// 送信成功時
await writeAuditLog(supabase, {
  module: 'leaf',
  action: 'chatwork_notify',
  entityType: 'chatwork_message',
  entityId: result.message_id,
  entityLabel: `leaf_kanden_${notificationKind}`,
  severity: 'info',
  notes: `room=${roomId} kind=${notificationKind}`,
});

// 送信失敗時
await writeAuditLog(supabase, {
  module: 'leaf',
  action: 'chatwork_notify_failed',
  severity: 'warn',
  notes: `kind=${notificationKind} error=${e.message}`,
});
```

---

## 9. 実装ステップ

### W1: Chatwork ルーム作成（東海林さん運用）
- [ ] 「Leaf 事務」ルーム新規作成
- [ ] Bot アカウント（【事務局】システム自動通知）を幹部組 + Leaf 事務 + 個別 DM に招待
- [ ] ルーム ID を Vercel env に登録（staging + production）

### W2: `rooms.ts` 拡張（0.05d）
- [ ] `CHATWORK_ROOMS.leafKandenAdmin()` / `leafKandenOffice()` 追加

### W3: テンプレ 6 種実装（0.2d）
- [ ] `src/lib/leaf/notifications.ts`
- [ ] `templates/` 配下に 6 種のビルダ関数
- [ ] dry-run モード対応

### W4: C-04 Cron への組込（0.1d）
- [ ] monthly-report: notifyMonthlyReport()
- [ ] pd-sync: notifyPdSyncDiff()（差分あり時のみ）
- [ ] status-reminder: notifyStaleCases()
- [ ] commission-calc: notifyCommissionAnomaly()（異常時のみ）

### W5: C-02 / C-03 への組込（0.1d）
- [ ] cancelCase → notifyCancellation()
- [ ] OCR 至急 SW 検出 → notifyUrgentSW()

### W6: 段階リリース（0.05d、運用面）
- [ ] dry-run → staging → 本番 1 ルーム → 全ルーム の 4 段階実施

---

## 10. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | 月次レポートの PDF を本文添付 | **添付しない**（案 D 方針、Garden ログイン誘導のみ）|
| 判2 | 通知頻度の上限 | 事務ルーム 週 50 件以内、幹部組 月 30 件以内を目安、超過時は集約 |
| 判3 | 通知の既読確認 | Phase C では未対応、Phase D で「既読マーク」検討 |
| 判4 | Chatwork の return_value で自動返信 | 本 Bot は投稿のみ、返信は Phase D |
| 判5 | 休日配信の抑止 | 手数料異常・解約は即時、滞留・月次は平日のみ |
| 判6 | 個別 DM の送信ログ保持 | **root_audit_log のみ**、本文 hash 化は不要（明文のまま記録）|

---

## 11. 関連参照

- **spec-cross-chatwork**（Batch 7）: ルーム ID 環境変数化・dry-run・段階リリース
- **C-04**: Cron トリガ
- **C-02**: cancelCase Server Action
- **C-03**: OCR 至急 SW 検出
- **project_chatwork_bot_ownership memory**: Bot 運用
- **feedback_external_integration_staging**: 段階リリース方針

— end of C-05 —
