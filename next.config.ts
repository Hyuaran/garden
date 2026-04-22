import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発時の左下「N」インジケータを右下へ退避させる。
  // 既定位置 (bottom-left) では Garden-Tree のサイドバー左下の権限切替ボタンと
  // クリック領域が重なり、操作できなくなるため。
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
