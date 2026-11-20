import { MAX_PHOTO_BYTES } from "@/lib/leaf-kanden/submissions";

export async function compressKandenPhoto(file: File) {
  if (file.size > MAX_PHOTO_BYTES) throw new Error("写メは1枚10MBまでです。");
  let source: Blob = file;
  if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    const { default: convert } = await import("heic2any");
    const result = await convert({ blob: file, toType: "image/jpeg", quality: 0.95 });
    source = Array.isArray(result) ? result[0] : result;
  }

  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1500 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("写メを読み込めませんでした。");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob && blob.size <= MAX_PHOTO_BYTES) resolve(blob);
        else reject(new Error("写メを読み込めませんでした。"));
      }, "image/jpeg", 0.85);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
