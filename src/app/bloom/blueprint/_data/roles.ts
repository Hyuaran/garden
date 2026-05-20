export type RoleAllocation = {
  name: string;
  position: string;
  responsibilities: string[];
  recordTarget: string;
};

export const roleAllocations: RoleAllocation[] = [
  {
    name: "Claude main",
    position: "司令塔",
    responsibilities: [
      "設計整理と判断履歴の維持",
      "Dispatch の起草と作業分配",
      "Obsidian Daily への文脈整理",
    ],
    recordTarget: "010_Daily/2026-05-20/020_Claude/",
  },
  {
    name: "Codex",
    position: "実装と検証",
    responsibilities: [
      "UI 実装とローカル検証",
      "ブラウザ確認とスクリーンショット取得",
      "コードレビューと実装メモの作成",
    ],
    recordTarget: "010_Daily/YYYY-MM-DD/010_Codex/",
  },
  {
    name: "ChatGPT",
    position: "構想と壁打ち",
    responsibilities: [
      "UI 構想とモック作成",
      "プロンプト作成とセカンドオピニオン",
      "デザイン案・表現案の比較",
    ],
    recordTarget: "010_Daily/YYYY-MM-DD/030_ChatGPT/",
  },
];
