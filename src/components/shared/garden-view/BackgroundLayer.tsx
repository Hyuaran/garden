/**
 * 盆栽ビュー — 背景レイヤー（差し替え可能）
 *
 * Phase 2-0: linear-gradient placeholder（朝の空をイメージ）
 * Phase 2-1 (cross-ui-04 改訂後): AI 画像 / 時間帯ごとの背景画像に差し替え
 *
 * モジュール配置 layer（ModuleLayer）とは完全分離（memory project_godo_ux_adoption_gate）
 */

export function BackgroundLayer() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        background:
          "linear-gradient(180deg, #87CEEB 0%, #B8E0F0 30%, #E0F6FF 60%, #FAF8F3 100%)",
      }}
    />
  );
}
