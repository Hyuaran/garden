/**
 * Garden 認証成功後の権限別 redirect ヘルパー
 *
 * memory project_garden_dual_axis_navigation §7 準拠（2026-04-27 確定）:
 *   - super_admin / admin / manager / staff → /home（暫定: / を使用、/home は未配置）
 *   - closer / toss → /tree（架電業務専用）
 *   - cs → /home（暫定、5/5 後 CS ヒアリングで確定）
 *   - outsource → /leaf/kanden（暫定 hardcode、partner_code lookup は post-5/5 spec）
 *
 * 注: GardenRole 型は string union として `cs` まで含むが outsource は型に未追加。
 *     ランタイム string で受けて outsource にも対応（型変更は別 dispatch）。
 */

export function getPostLoginRedirect(role: string | null | undefined): string {
  switch (role) {
    // staff 系 → home（業務全体俯瞰）
    case "super_admin":
    case "admin":
    case "manager":
    case "staff":
    case "cs": // 5/5 後確定、暫定 home
      return "/";

    // 架電業務専用
    case "closer":
    case "toss":
      return "/tree";

    // 外注パートナー（partner_code lookup は post-5/5）
    case "outsource":
      return "/leaf/kanden";

    // 不明 / null → home（フォールバック）
    default:
      return "/";
  }
}
