export function joinPdfTextItems(items: unknown[]) {
  const lines: string[] = [];
  let line = "";
  for (const value of items) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    line += typeof item.str === "string" ? item.str : "";
    if (item.hasEOL === true) {
      lines.push(line);
      line = "";
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

/** Vercelのサーバ関数を経由せず、ブラウザでPDFの文字だけを取り出す。 */
export async function extractContractPdfPages(blob: Blob): Promise<string[]> {
  const specifier = "/vendor/pdfjs/pdf.min.mjs";
  const pdfjs = (await import(/* webpackIgnore: true */ specifier)) as typeof import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(joinPdfTextItems(content.items));
      page.cleanup();
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}
