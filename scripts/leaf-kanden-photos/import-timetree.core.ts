import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

export type TimeTreeImage = [key: string, width: number, height: number];
export type TimeTreeEvent = { id: string; d: string; no: string; imgs: TimeTreeImage[] };
type Selection = { from?: string; to?: string; limit?: number };

export function selectEvents(
  events: TimeTreeEvent[],
  existingKeys: ReadonlySet<string>,
  { from, to, limit }: Selection,
  repairKeys: ReadonlySet<string> = new Set(),
): TimeTreeEvent[] {
  const selected = new Map<string, TimeTreeEvent>();
  const seen = new Set(existingKeys);
  for (const event of events) {
    if (!event.imgs.length || (from && (!event.d || event.d < from)) ||
        (to && (!event.d || event.d > to))) continue;
    const current = selected.get(event.id);
    if (!current && limit !== undefined && selected.size >= limit) continue;

    const imgs = event.imgs.filter(([key]) => {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (current) current.imgs.push(...imgs);
    else if (imgs.length || repairKeys.has(`timetree:${event.id}`)) {
      selected.set(event.id, { ...event, imgs });
    }
  }
  return [...selected.values()];
}

export function storagePaths(event: Pick<TimeTreeEvent, "id" | "d">) {
  const month = event.d ? event.d.slice(0, 7).replace("-", "/") : "unknown";
  const stem = `timetree/${month}/${event.id}`;
  return {
    pdf: `pdf/${stem}.pdf`,
    image: (key: string) => `${stem}/${key.slice(key.lastIndexOf("/") + 1)}`,
  };
}

export async function buildPdf(
  photos: ReadonlyArray<{ source_key: string; image_path: string }>,
  readImage: (path: string) => Promise<Uint8Array>,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const sorted = [...photos].sort((a, b) =>
    a.source_key < b.source_key ? -1 : Number(a.source_key > b.source_key));
  for (const photo of sorted) {
    const bytes = await readImage(photo.image_path);
    // 拡張子ではなく中身で判断する（名前が .jpg で中身が PNG の写メが TimeTree にある・2026-11-20）
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const image = isPng ? await pdf.embedPng(bytes)
      : await pdf.embedJpg(isJpeg ? bytes : await sharp(bytes).jpeg().toBuffer());
    const { width, height } = image;
    pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  }
  return pdf.save();
}
