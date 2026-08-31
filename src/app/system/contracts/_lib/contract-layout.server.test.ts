// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PDFDocument, PDFOperator, PDFOperatorNames, rectangle, StandardFonts } from "pdf-lib";
import { extractContractLayout, reconstructPage, type PositionedText, type Rule } from "./contract-layout.server";
const item = (text: string, x: number, y: number, width = 40): PositionedText => ({ text, x, y, width, height: 10 });
describe("contract coordinate layout", () => {
  it("joins close Y positions and recognizes repeated X columns over at least three rows", () => {
    const result = reconstructPage([item("Heading", 40, 770),
      ...[720, 700, 680].flatMap((y, r) => [item(`Product${r}`, 40, y), item(`Value${r}`, 180, y - 1)])]);
    expect(result[0]).toEqual({ type: "text", text: "Heading" });
    expect(result[1]).toMatchObject({ type: "table", rows: [["Product0", "Value0"], ["Product1", "Value1"], ["Product2", "Value2"]] });
  });
  it("does not mistake two rows, article numbers or ordinary prose for a table", () => {
    for (const items of [
      [item("A", 40, 720), item("B", 180, 720), item("C", 40, 700), item("D", 180, 700)],
      [720, 700, 680].flatMap((y) => [item("1.", 40, y, 10), item("Clause", 60, y)]),
      [720, 700, 680].map((y) => item("One long prose line", 40, y, 480)),
    ]) expect(reconstructPage(items).every((b) => b.type === "text")).toBe(true);
  });
  it("reconstructs ruled cells, preserving wrapped text and a missing cell without shifting columns", () => {
    const rules: Rule[] = [
      ...[40, 150, 300].map((x) => ({ x1: x, x2: x, y1: 600, y2: 750 })),
      ...[600, 650, 700, 750].map((y) => ({ x1: 40, x2: 300, y1: y, y2: y })),
    ];
    const blocks = reconstructPage([item("Product", 50, 730), item("Price", 160, 731),
      item("Wrapped", 50, 680), item("product", 50, 667), item("5,000", 170, 670),
      item("Another", 50, 630)], rules);
    expect(blocks).toEqual([{ type: "table", rows: [["Product", "Price"], ["Wrapped\nproduct", "5,000"], ["Another", ""]], widths: [110, 150], caption: undefined }]);
  });
  it("reads an actual PDF in Node with a usable worker and CMap paths", async () => {
    const pdf = await PDFDocument.create(), page = pdf.addPage(), font = await pdf.embedFont(StandardFonts.Helvetica);
    for (const y of [700, 675, 650]) {
      page.drawText("Product", { x: 40, y, size: 10, font }); page.drawText("100 yen", { x: 200, y, size: 10, font });
    }
    const pages = await extractContractLayout(await pdf.save());
    expect(pages[0][0]).toMatchObject({ type: "table", rows: [["Product", "100 yen"], ["Product", "100 yen"], ["Product", "100 yen"]] });
  });
  it("accepts thin even-odd filled rules and rebuilds two logical rows with three physical text rows", async () => {
    const pdf = await PDFDocument.create(), page = pdf.addPage(), font = await pdf.embedFont(StandardFonts.Helvetica);
    for (const y of [650, 690, 740]) page.pushOperators(rectangle(40, y, 260, 0.5), PDFOperator.of(PDFOperatorNames.FillEvenOdd));
    for (const x of [40, 150, 300]) page.pushOperators(rectangle(x, 650, 0.5, 90), PDFOperator.of(PDFOperatorNames.FillEvenOdd));
    for (const [text, x, y] of [["Product", 50, 720], ["Price", 180, 720], ["Wrapped", 50, 675], ["product", 50, 660], ["100 yen", 180, 670]] as const)
      page.drawText(text, { x, y, size: 10, font });
    const blocks = (await extractContractLayout(await pdf.save()))[0];
    expect(blocks[0]).toMatchObject({ type: "table", rows: [["Product", "Price"], ["Wrapped\nproduct", "100 yen"]] });
  });
});
