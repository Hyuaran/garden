export type BlueprintNote = {
  title: string;
  body: string;
  severity: "確認" | "保護" | "未確定";
};

export const blueprintNotes: BlueprintNote[] = [
  {
    title: "正本リポジトリは未確定",
    body:
      "a-bloom-006 は Bloom 先行実装の参考元として扱う。最終的な正本リポジトリへの反映は別 Dispatch で判断する。",
    severity: "未確定",
  },
  {
    title: "C:\\garden から C:\\Claude\\Garden への移行は未実施",
    body:
      "git worktree、絶対パス、AI 記憶フォルダに影響するため、全セッション停止後の独立作業として扱う。",
    severity: "確認",
  },
  {
    title: "/bloom/progress は保護対象",
    body:
      "現行の iframe + 静的 HTML 版はデモ可能な現物。Blueprint MVP ではリンクと確認のみ行い、実装には手を加えない。",
    severity: "保護",
  },
  {
    title: "静的データは第 1 版",
    body:
      "段階 % と説明文は既存 Bloom 実装・Obsidian ノートから読み取れる範囲で配置した。第 2 版以降で Obsidian Markdown 連携や Supabase 連携を検討する。",
    severity: "確認",
  },
  {
    title: "自動集計・Chatwork・PDF は対象外",
    body:
      "今回の MVP は読み取り専用の設計図。DB write、Chatwork 通知、PDF 生成、画像生成、自動集計の新規追加は行わない。",
    severity: "保護",
  },
];
