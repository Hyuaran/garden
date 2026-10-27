import { Image } from "@react-pdf/renderer";
/** 21mm, overlaid so existing text and pagination stay identical. */
export function CompanySeal({src, placement = "right"}: {src?: string; placement?: "right" | "afterAddressee"}) {
 if (!src) return null;
 // Keep PNG bytes explicit at the server-side renderer boundary.
 const png = /^data:image\/png;base64,([\s\S]*)$/.exec(src);
 const source = png ? { data: Buffer.from(png[1], "base64"), format: "png" as const } : src;
 return <Image src={source} style={placement === "afterAddressee" ? {position:"absolute",left:150,top:-22,width:59.53,height:59.53} : {position:"absolute",right:-30,top:-16,width:59.53,height:59.53}} />;
}
