// @vitest-environment node
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { expect, it, vi } from "vitest";
import { buildPdf, selectEvents, storagePaths, type TimeTreeEvent } from "./import-timetree.core";

const events: TimeTreeEvent[] = [
  { id: "old", d: "2026-11-18", no: "", imgs: [["old.jpg", 1, 1]] },
  { id: "late", d: "2026-11-19", no: "", imgs: [["old.jpg", 1, 1], ["new.jpg", 2, 2], ["new.jpg", 2, 2]] },
  { id: "unknown", d: "", no: "", imgs: [["unknown.jpg", 1, 1]] },
  { id: "empty", d: "2026-11-19", no: "", imgs: [] },
];

it("applies the limit after filtering dates and imported photos", () => {
  expect(selectEvents(events, new Set(["old.jpg"]), { from: "2026-11-19", to: "2026-11-19", limit: 1 }))
    .toEqual([{ ...events[1], imgs: [["new.jpg", 2, 2]] }]);
  expect(selectEvents(events, new Set(["old.jpg", "new.jpg"]), { limit: 1 }))
    .toEqual([events[2]]);
});

it("reselects an event when only its PDF needs repair", () => {
  expect(selectEvents(events, new Set(["old.jpg", "new.jpg", "unknown.jpg"]), {}, new Set(["timetree:late"])))
    .toEqual([{ ...events[1], imgs: [] }]);
});

it("uses the event month and the last portion of the object key", () => {
  const dated = storagePaths(events[1]);
  expect(dated.image("calendar/id/new.jpg")).toBe("timetree/2026/11/late/new.jpg");
  expect(dated.pdf).toBe("pdf/timetree/2026/11/late.pdf");
  const undated = storagePaths(events[2]);
  expect(undated.image("calendar/id/new.jpg")).toBe("timetree/unknown/unknown/new.jpg");
  expect(undated.pdf).toBe("pdf/timetree/unknown/unknown.pdf");
});

it("reads stored images in object-key order and makes one image-sized page per photo", async () => {
  const create = (width: number, height: number) => sharp({
    create: { width, height, channels: 3, background: "white" },
  });
  const jpeg = await create(8, 12).jpeg().toBuffer();
  const png = await create(15, 6).png().toBuffer();
  const readImage = vi.fn(async (path: string) => path === "stored/a.jpg" ? jpeg : png);
  const bytes = await buildPdf([
    { source_key: "calendar/z.jpg", image_path: "stored/a.jpg" },
    { source_key: "calendar/a.png", image_path: "stored/z.png" },
  ], readImage);

  expect(readImage.mock.calls).toEqual([["stored/z.png"], ["stored/a.jpg"]]);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPages().map((page) => page.getSize())).toEqual([
    { width: 15, height: 6 },
    { width: 8, height: 12 },
  ]);
});
