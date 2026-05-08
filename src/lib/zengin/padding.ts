/**
 * Garden-Bud / 全銀協 CSV — 桁埋めヘルパ
 *
 * 全銀協フォーマットは各フィールドが固定桁数。値が桁数を超える場合は
 * サイレントに切詰めると金融 ID が破損するため、必ず throw する。
 *
 * - padRight:    右側に半角スペースを埋める（左詰め、文字列用）
 * - padLeftZero: 左側に '0' を埋める（右寄せ、数値用）
 */

export function padRight(s: string, length: number): string {
  if (s.length > length) {
    throw new Error(`値が ${length} 桁を超えています: "${s}" (${s.length}桁)`);
  }
  return s + " ".repeat(length - s.length);
}

export function padLeftZero(s: string, length: number): string {
  if (s.length > length) {
    throw new Error(`値が ${length} 桁を超えています: "${s}" (${s.length}桁)`);
  }
  return "0".repeat(length - s.length) + s;
}
