export type SourceLinkGroup = {
  title: string;
  description: string;
  items: Array<{
    label: string;
    path: string;
    note: string;
  }>;
};

export const sourceLinkGroups: SourceLinkGroup[] = [
  {
    title: "Obsidian Vault",
    description: "設計・判断・依頼・作業実績の一次情報源。",
    items: [
      {
        label: "Garden 設計ノート",
        path: "100_Projects/110_Garden/",
        note: "モジュール別ノート、共通ルール、現況整理の置き場。",
      },
      {
        label: "Dispatch",
        path: "015_Dispatch/",
        note: "Claude main から Codex / ChatGPT への依頼書。",
      },
      {
        label: "Daily",
        path: "010_Daily/YYYY-MM-DD/",
        note: "AI 別の作業実績、判断結果、検証ログ。",
      },
      {
        label: "AI Rules",
        path: "070_AI-Rules/",
        note: "AI 間の作業ルール、Dispatch 運用、共通前提。",
      },
    ],
  },
  {
    title: "Local / Git",
    description: "コードと検証環境。正本は未確定のため、現在は a-bloom-006 を参考実装として扱う。",
    items: [
      {
        label: "Bloom 参考実装",
        path: "C:\\garden\\a-bloom-006",
        note: "今回の /bloom/blueprint MVP 実装対象。",
      },
      {
        label: "推奨作業ブランチ",
        path: "codex/bloom-blueprint-mvp",
        note: "PR 作成は別 Dispatch で実施する。",
      },
      {
        label: "保護対象",
        path: "src/app/bloom/progress/",
        note: "iframe + 静的 HTML 版の Garden 開発進捗。今回一切変更しない。",
      },
    ],
  },
];
