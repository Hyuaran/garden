/**
 * 盆栽ビュー — 中央 visual centerpiece
 *
 * cross-ui-06 §3.2 で BonsaiCenter として 12 モジュールから独立した視覚要素。
 * (0, 0) = container 中央 に配置。
 *
 * Phase 2-1: 暫定の絵文字 + 円形 wrapper。
 * Phase 2-2 以降で AI 画像 / SVG イラストに差し替え予定。
 */

export function BonsaiCenter() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 1, // BackgroundLayer (0) と ModuleLayer (2) の間
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: 160,
        height: 160,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 70%, transparent 100%)",
        pointerEvents: "none",
      }}
    >
      <div style={{ fontSize: 96, lineHeight: 1 }}>🪴</div>
    </div>
  );
}
