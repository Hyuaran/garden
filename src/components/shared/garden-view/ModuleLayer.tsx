/**
 * 盆栽ビュー — 12 モジュールの絶対配置 container
 *
 * BackgroundLayer の上に重なる layer。座標は slot-positions.ts に集約。
 */

import { ModuleSlot } from "./ModuleSlot";
import { MODULES, MODULE_KEYS } from "./_lib/modules";
import { SLOT_POSITIONS } from "./_lib/slot-positions";

export function ModuleLayer() {
  return (
    <div
      aria-label="Garden 12 モジュール"
      style={{ position: "absolute", inset: 0, zIndex: 2 }}
    >
      {MODULE_KEYS.map((key) => (
        <ModuleSlot
          key={key}
          module={MODULES[key]}
          position={SLOT_POSITIONS[key]}
        />
      ))}
    </div>
  );
}
