export type NoticeClientPage = { base64: string; url: string };

export async function attachmentToNoticePages(blob: Blob): Promise<{ pages: NoticeClientPage[]; truncated: boolean }> {
  if (blob.type !== "application/pdf") {
    if (!blob.type.startsWith("image/")) throw new Error("周知に使えるのはPDFまたは画像です");
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像変換を開始できませんでした");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const base64 = canvas.toDataURL("image/png");
    return { pages: [{ base64, url: base64 }], truncated: false };
  }
  // pdfjs-dist を webpack が bundle すると "Object.defineProperty called on non-object"
  // で評価に失敗する（モダン/legacy 両ビルドで実機実測・__webpack_require__.r 起点）。
  // public/vendor に置いた同バージョンのビルドをブラウザのネイティブ import で読む。
  const specifier = "/vendor/pdfjs/pdf.min.mjs";
  const pdfjs = (await import(/* webpackIgnore: true */ specifier)) as typeof import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
  const count = Math.min(pdf.numPages, 20);
  const pages: NoticeClientPage[] = [];
  for (let pageNumber = 1; pageNumber <= count; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const initial = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 2000 / Math.max(initial.width, initial.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PDF画像化を開始できませんでした");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const base64 = canvas.toDataURL("image/png");
    pages.push({ base64, url: base64 });
    page.cleanup();
  }
  await pdf.destroy();
  return { pages, truncated: pdf.numPages > count };
}

export function downloadDataUrl(url: string, name: string) {
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
}
