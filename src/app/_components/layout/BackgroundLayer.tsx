/**
 * BackgroundLayer (v2.8a Step 5 — 動的版)
 *
 * DESIGN_SPEC §4-7
 *
 * prototype のクロスフェード方式を再現:
 *   - 2 layer (bgLayer1 / bgLayer2) を交互に active
 *   - active な layer の opacity 1, 非 active は 0
 *   - layer1Src / layer2Src を切り替え + activeLayer を切り替え
 *
 * Step 5: 動的 prop 配線済み
 *   - layer1Src / layer2Src: 各 layer の現在の url
 *   - activeLayer: 1 か 2、active 側に opacity 1
 *   - onClickZone: 背景 click handler（クリックで次の bg）
 *   - showHint: ヒント表示
 *
 * 背景画像 6 種:
 *   - bg_01_morning.png  朝
 *   - bg_02_water.png    水
 *   - bg_03_glassdisk.png ガラス
 *   - bg_04_crystal.png  結晶
 *   - bg_05_sunlight.png 陽光
 *   - bg_06_night.png    夜（dark theme 用）
 */
type Props = {
  layer1Src?: string;
  layer2Src?: string;
  activeLayer?: 1 | 2;
  onClickZone?: () => void;
  showHint?: boolean;
};

export default function BackgroundLayer({
  layer1Src = "/images/backgrounds/bg_01_morning.png",
  layer2Src,
  activeLayer = 1,
  onClickZone,
  showHint = false,
}: Props = {}) {
  return (
    <>
      {/* ===== 背景画像レイヤー (cross-fade) ===== */}
      <div
        className={`bg-layer${activeLayer === 1 ? " active" : ""}`}
        id="bgLayer1"
        style={
          layer1Src ? { backgroundImage: `url('${layer1Src}')` } : undefined
        }
      />
      <div
        className={`bg-layer${activeLayer === 2 ? " active" : ""}`}
        id="bgLayer2"
        style={
          layer2Src ? { backgroundImage: `url('${layer2Src}')` } : undefined
        }
      />
      <div className="bg-layer-overlay" />

      {/* ===== クリック検知ゾーン ===== */}
      <div
        className="bg-click-zone"
        id="bgClickZone"
        onClick={onClickZone}
        role={onClickZone ? "button" : undefined}
        aria-label={onClickZone ? "背景を切り替える" : undefined}
      />

      {/* ===== クリックヒント (fade-in アニメ) ===== */}
      <div className={`bg-hint${showHint ? " show" : ""}`} id="bgHint">
        クリックで背景を切替
      </div>
    </>
  );
}
