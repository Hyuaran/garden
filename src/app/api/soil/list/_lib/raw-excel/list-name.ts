export type ListNameResult = { value: string; review?: string };

const KIND_MAP: Record<string, string> = {
  F: "フレッツ",
  "Ｆ": "フレッツ",
  "アナログ": "アナログ",
};

export function baseName(fileName: string): string {
  return fileName.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "");
}

export function hikariListNameFromFile(fileName: string): ListNameResult {
  const name = baseName(fileName);
  const normalized = name.normalize("NFKC");
  const already = /^(【[^】]+】.+?_\d{8})(?:[_\-（(].*)?$/.exec(name);
  if (already && !/[×✕xX]/.test(name)) return { value: already[1] };
  const match = /^(【[^】]+】)?([^×✕xX]+)[×✕xX].*?(\d{8})\s*$/.exec(name)
    ?? /^(【[^】]+】)?(アナログ|F|Ｆ).*?(\d{8})\s*$/.exec(normalized);
  if (!match?.[3] || !match[2]) {
    return { value: "", review: `リスト名を作れませんでした（ファイル名：${name}）` };
  }
  const kind = KIND_MAP[match[2].trim()] ?? "";
  if (!kind) return { value: "", review: `リスト名を作れませんでした（ファイル名：${name}）` };
  return { value: `${match[1] ?? "【光回線】"}${kind}_${match[3]}` };
}

export function kurekaListName(raw: string, fileName: string): ListNameResult {
  const value = raw.trim() || baseName(fileName);
  return value ? { value } : { value: "", review: `リスト名を作れませんでした（ファイル名：${baseName(fileName)}）` };
}
