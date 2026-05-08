import { StatusScreen } from "../_components/StatusScreen";

/**
 * 離席中ステータス画面 (/away)
 *
 * v7 Group C で新規作成。中央配置レイアウト + Green Screen 配色。
 * tree call center や全モジュールから「離席中」状態時に遷移可能。
 * 5/5 デモは static、post-5/5 で動的時刻 / 再開予定 / 状態 連携予定。
 */

export const dynamic = "force-dynamic";

export default function AwayPage() {
  return <StatusScreen variant="away" />;
}
