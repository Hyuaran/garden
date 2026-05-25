import { blueprintCommonNotes, moduleBlueprints } from "./modules";
import { blueprintOverview } from "./overview";

export function buildGardenBlueprintMarkdown() {
  const lines = [
    "# Garden 設計図",
    "",
    blueprintOverview.lead,
    "",
    "## 設計方針",
    ...blueprintOverview.principles.flatMap((principle) => [
      "",
      `### ${principle.title}`,
      principle.body,
    ]),
    "",
    "## 共通注記",
    ...blueprintCommonNotes.map((note) => `- ${note}`),
    "",
    "## 12 モジュール設計",
    ...moduleBlueprints.flatMap((module) => [
      "",
      `## ${module.name}（${module.code2}）`,
      `- 役割: ${module.role}`,
      `- 概要: ${module.summary}`,
      `- 主な機能・想定画面: ${module.features.join(" / ")}`,
      `- 関連: ${module.relations}`,
      `- フォルダ: ${module.folder}`,
      `- 段階: ${module.stageLabel}`,
      ...(module.note ? [`- 特記: ${module.note}`] : []),
    ]),
    "",
  ];

  return lines.join("\n");
}
