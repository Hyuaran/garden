import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // 全スイート実行時の jsdom ワーカー数を抑え、メモリ使用量を安定させる。
    maxWorkers: 4,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/leaf-kanden-photos/*.test.ts", "scripts/leaf-kanden-orders/*.test.ts", "scripts/soil-kanden-list/*.test.ts", "scripts/leaf-kanden-payments/*.test.ts", "public/kintone/*.test.ts", "scripts/kokyaku-fuyo-points/*.test.ts"],
    exclude: ["node_modules", ".next", "dist"],
  },
});
