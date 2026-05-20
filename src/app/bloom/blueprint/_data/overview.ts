export const blueprintOverview = {
  eyebrow: "Garden Blueprint",
  title: "Garden 設計図",
  lead:
    "Garden Series は、複数モジュールを庭の世界観で整理する業務システム群です。Bloom は、その構造・役割・運用ルールを読み解くための入口として、進捗や日報とは別に「今の設計」を一画面にまとめます。",
  principles: [
    {
      title: "業務を庭として整理する",
      body:
        "根・幹・葉・蕾・開花といった植物比喩で、基盤から現場業務、経営可視化までの関係を直感的に把握できるようにします。",
    },
    {
      title: "装飾より読みやすさを優先する",
      body:
        "Garden らしい柔らかさは保ちつつ、実務画面として横スクロールや文字欠けを避け、繰り返し確認しやすい密度に整えます。",
    },
    {
      title: "一次情報は Obsidian に置く",
      body:
        "Blueprint は Obsidian Vault の設計ノートを見せる窓です。MVP は静的データで開始し、第 2 版以降で Markdown / Supabase 連携を検討します。",
    },
  ],
  references: [
    "100_Projects/110_Garden/000_Garden概要.md",
    "100_Projects/110_Garden/003_世界観とUI方針.md",
    "010_Daily/2026-05-20/020_Claude/003_新体制フロー整理完了まとめ.md",
  ],
} as const;
