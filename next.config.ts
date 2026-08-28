import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発時の左下「N」インジケータを右下へ退避させる。
  // 既定位置 (bottom-left) では Garden-Tree のサイドバー左下の権限切替ボタンと
  // クリック領域が重なり、操作できなくなるため。
  devIndicators: {
    position: "bottom-right",
  },
  // sharp はネイティブバイナリを含むためバンドルさせない（Vercel の関数ランタイムで
  // バンドル経由だと読み込みに失敗し、/api/bud/expense-ocr が 500 になる）
  // pdfjs-dist もバンドルすると "Object.defineProperty called on non-object" で
  // サーバ側の評価に失敗する（/api/system/contracts で実機確認・2026-08-28）
  serverExternalPackages: ["sharp", "pdfjs-dist"],
};

export default nextConfig;
