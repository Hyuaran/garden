import { StatusScreen } from "../_components/StatusScreen";

/**
 * 休憩中ステータス画面 (/break)
 *
 * v7 Group C で新規作成。中央配置レイアウト + Take a gentle break 暖色配色。
 * tree call center や全モジュールから「休憩中」状態時に遷移可能。
 * 5/5 デモは static、post-5/5 で動的再開予定 / 状態 連携予定。
 */

export const dynamic = "force-dynamic";

export default function BreakPage() {
  return <StatusScreen variant="break" />;
}
