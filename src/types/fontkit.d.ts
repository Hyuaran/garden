declare module "fontkit" {
  type GlyphRun = {
    glyphs: Array<{ path: { toSVG(): string } }>;
    positions: Array<{ xAdvance: number; xOffset: number; yOffset: number }>;
  };
  type Font = { unitsPerEm: number; layout(text: string): GlyphRun };
  export function openSync(filename: string): Font;
}
