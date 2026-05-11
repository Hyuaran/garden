# Garden UI 共通テンプレート: activity-panel（右サイドバー）

> 出典: `_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html` line 1421-1484（既稼働 Forest UI から抽出）
> 起草: a-main-020、2026-05-11 10:30
> 適用範囲: Garden 全モジュール共通候補（構造は共通、内容のみモジュール別）
> 構造: activity-header + activity-list（5-7 件）+ notify-btn

## 構造（HTML、コピペベース）

```html
<aside class="activity-panel" id="activityPanel">
 <div class="activity-header">
   <div class="activity-title">
     <h3>今日の[モジュール]アクティビティ</h3>
   </div>
   <a href="#" class="activity-all">すべて表示</a>
 </div>

 <ul class="activity-list">
   <!-- 5-7 件のアクティビティ、時系列降順 -->
   <li class="activity-item">
     <span class="activity-time">[時刻]</span>
     <span class="activity-icon" style="background:[色 + 透過];color:[色];display:inline-flex;align-items:center;justify-content:center;border-radius:50%;width:32px;height:32px;font-weight:600;">[1 文字 or 絵文字]</span>
     <div class="activity-body">
       <strong>[タイトル]</strong>
       <p>[詳細]</p>
     </div>
   </li>
   <li class="activity-item">
     <span class="activity-time">[時刻]</span>
     <span class="activity-icon-check">✓</span>
     <div class="activity-body">
       <strong>[タイトル]</strong>
       <p>[詳細]</p>
     </div>
   </li>
   ...（5-7 件）
 </ul>

 <button class="notify-btn">
   <span>⚙</span> 通知設定をカスタマイズ
   <span class="arrow">›</span>
 </button>
</aside>
```

## モジュール別カスタマイズ表

| 箇所 | Forest 既稼働 | Bloom / Tree / 他モジュール |
|---|---|---|
| activity-title | 「今日の経営アクティビティ」 | 「本日のコール状況」（Tree）/「本日の日報サマリー」（Bloom）/ 等 |
| activity-list | 6 件（売上更新 / 試算表確定 / 預金警告 / 納税期限 / 第 1 期 / 月次パッケージ） | モジュール固有のアクティビティ 5-7 件 |
| activity-icon | 6 法人カラー（ARATA / リンクサポート / 壱 等）+ ✓ + 税 + 📑 アイコン | モジュール固有のアイコン体系 |
| notify-btn | 共通（通知設定） | 共通 |

## activity-icon の色設計

### 6 法人カラー（Forest / Bloom 等で共通）

| 法人 | カラー | アイコン例 |
|---|---|---|
| ヒュアラン | #F4A6BD | ヒ |
| センターライズ | #8E7CC3 | セ |
| リンクサポート | #4A6FA5 | L |
| ARATA | #E8743C | A |
| たいよう | #F9C846 | た |
| 壱 | #C0392B | 壱 |

### 状態系アイコン（モジュール横断共通）

| アイコン | 用途 | 推奨カラー |
|---|---|---|
| ✓ | 完了 / 確定 | activity-icon-check（緑系） |
| 税 | 納税系 | 黄系（#b8860b on rgba(249,200,70,0.2)） |
| 📑 | レポート系 | 緑系 |
| ⚠ | 警告 | 赤系 |
| ⚡ | 緊急 | 橙系 |

## 注意事項

| # | 内容 |
|---|---|
| 1 | activity-list は時系列降順（最新が上）|
| 2 | アクティビティ件数は 5-7 件推奨（多すぎるとスクロール、少なすぎると寂しい） |
| 3 | 「昨 18:30」のような相対時刻表記は前日以前で使用、当日は HH:MM 形式 |
| 4 | gf-activity-corp-dot 等のモジュール固有 class は activity-panel テンプレ外で各モジュール CSS 定義 |
| 5 | activity-all リンクは「もっと見る」「すべて表示」モジュール内の活動履歴ページへ遷移想定 |

## 改訂履歴

- 2026-05-11 10:30 v1 初版（a-main-020 起草、Forest UI シフト議論の共通テンプレート抽出第 3 弾、tab-1 既稼働から抽出）
