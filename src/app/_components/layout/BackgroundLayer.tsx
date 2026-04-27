/**
 * BackgroundLayer (v2.8a Step 3 — 静的版)
 *
 * DESIGN_SPEC §4-7
 *
 * 5 種の light 背景 + 1 種の dark 背景を重ねるコンテナ。
 * Step 3 では bg_01_morning.png のみ初期表示。
 * Step 4 で fade transition + click 切替 + theme 連動を配線予定。
 *
 * 背景画像 6 種:
 *   - bg_01_morning.png  朝
 *   - bg_02_water.png    水
 *   - bg_03_glassdisk.png ガラス
 *   - bg_04_crystal.png  結晶
 *   - bg_05_sunlight.png 陽光
 *   - bg_06_night.png    夜（dark theme 用）
 */
export default function BackgroundLayer() {
  return (
    <>
      {/* ===== 背景画像レイヤー ===== */}
      <div
        className="bg-layer active"
        id="bgLayer1"
        style={{ backgroundImage: "url('/images/backgrounds/bg_01_morning.png')" }}
      />
      <div className="bg-layer" id="bgLayer2" />
      <div className="bg-layer-overlay" />

      {/* ===== クリック検知ゾーン (Step 4 で配線) ===== */}
      <div className="bg-click-zone" id="bgClickZone" />

      {/* ===== クリックヒント (Step 4 で fade-in アニメ配線) ===== */}
      <div className="bg-hint" id="bgHint">
        クリックで背景を切替
      </div>
    </>
  );
}
