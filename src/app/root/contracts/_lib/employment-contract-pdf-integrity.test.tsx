import { expect, it } from "vitest";
import sharp from "sharp";
import { inflateSync } from "node:zlib";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument, PDFRawStream, PDFName, PDFDict, decodePDFRawStream } from "pdf-lib";
import { renderEmploymentContractPdf } from "./employment-contract-pdf.server";
import { contractDefaults } from "./employment-contract";
import { renderNdaPdf, renderEmergencyContactPdf } from "@/app/system/mypage/_lib/todoke-pdf.server";

const base = {
 companyName:"株式会社ヒュアラン", representative:"代表太郎", companyAddress:"大阪府大阪市中央区南本町二丁目６番１２号 サンマリオンタワー地上２階西号室", employeeName:"見本　太郎",
 kind:"new" as const, contractStart:"2026-11-01", contractEnd:"2027-01-31", jobType:"sales" as const,
 jobTypeOther:"", hourlyWage:260000, workLocation:"大阪府大阪市", concludedOn:"2026-10-27", employeeAddress:"大阪府大阪市",
};
it("decodes seals and embedded bold fonts across successive document types without automatic hyphens", async () => {
 const png=await sharp({create:{width:32,height:32,channels:4,background:{r:220,g:0,b:0,alpha:0.65}}}).png().toBuffer();
 const companySeal=`data:image/png;base64,${png.toString("base64")}`;
 const renders = [
  ...(["part_time","full_time","nhk_dispatch"] as const).map(templateType=>()=>renderEmploymentContractPdf({...base,...contractDefaults(templateType),templateType,companySeal})),
  ()=>renderNdaPdf({...base,companySeal,pledgeDate:base.concludedOn,address:base.employeeAddress}),
  ()=>renderEmergencyContactPdf({...base,companySeal,selfAddress:base.employeeAddress,selfPhone:"09000000000",ecName:"家族太郎",ecRelationship:"父",ecAddress:"同上",ecPhone:"08000000000",submittedAt:new Date("2026-10-27T00:00:00Z")}),
 ];
 for (const [index,render] of renders.entries()) {
  const buffer=await render();
  const pdf=await getDocument({data:new Uint8Array(buffer)}).promise;
  expect(pdf.numPages).toBe(index < 3 ? 3 : index === 3 ? 2 : 1);
  let images=0, text="";
  for(let n=1;n<=pdf.numPages;n++) {
   const page=await pdf.getPage(n);
   const content=await page.getTextContent();
   for(const item of content.items) if("str" in item) {text+=item.str; expect(item.str,`document ${index} page ${n}: ${text.slice(-220)}`).not.toMatch(/-$/);}
   const ops=await page.getOperatorList();
   for(let i=0;i<ops.fnArray.length;i++) if(ops.fnArray[i]===OPS.paintImageXObject) {
    const img=await new Promise<{width:number;height:number;data?:Uint8Array;bitmap?:unknown}>(resolve=>page.objs.get(ops.argsArray[i][0],resolve));
    expect(img,`document ${index} image`).toBeTruthy();
    expect(img.width).toBe(32); expect(img.height).toBe(32);
    expect(img.data?.length || img.bitmap).toBeTruthy(); images++;
   }
  }
  expect(images).toBeGreaterThan(0);
  if(index===1 || index===2) for(const heading of ["労働条件通知書","雇用契約書","雇用期間"]) expect(text.replace(/\s/g,"" )).toContain(heading);
  // Text extraction can succeed via ToUnicode even when the embedded TTF is broken.
  const raw=await PDFDocument.load(buffer);
  let embeddedFonts=0, embeddedImages=0;
  for(const [,obj] of raw.context.enumerateIndirectObjects()) {
   if(obj instanceof PDFRawStream && obj.dict.get(PDFName.of("Subtype"))===PDFName.of("Image")) {
    // pdf.js may recover from a bad image stream with blank pixels, so also
    // require the actual XObject (including its alpha mask) to inflate.
    expect(inflateSync(obj.getContents()).length).toBeGreaterThan(0);
    embeddedImages++;
   }
  }
  expect(embeddedImages).toBeGreaterThan(0);
  for(const [,obj] of raw.context.enumerateIndirectObjects()) if(obj instanceof PDFDict && obj.has(PDFName.of("FontFile2"))) {
   const stream=raw.context.lookup(obj.get(PDFName.of("FontFile2")));
   if (!(stream instanceof PDFRawStream)) throw new Error("Missing embedded font stream");
   const font=Buffer.from(decodePDFRawStream(stream).decode());
   const tags=Array.from({length:font.readUInt16BE(4)},(_,i)=>font.toString("ascii",12+i*16,16+i*16));
   expect(tags,`document ${index} embedded TTF`).toContain("hmtx");
   embeddedFonts++;
  }
  expect(embeddedFonts).toBeGreaterThan(0);
  await pdf.destroy();
 }
},120000);
