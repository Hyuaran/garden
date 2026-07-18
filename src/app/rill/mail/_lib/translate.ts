const TRANSLATION_INPUT_LIMIT = 20_000;
const OMITTED_MARKER = "（以下略）";

export function mailBodyText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isLikelyNonJapanese(value: string) {
  const text = mailBodyText(value);
  const characters = Array.from(text).filter((character) => /[\p{L}\p{N}]/u.test(character));
  if (characters.length < 20 || !characters.some((character) => /\p{L}/u.test(character))) return false;
  const kana = characters.filter((character) => /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(character)).length;
  return kana / characters.length < 0.15;
}

export function prepareTranslationInput(value: string) {
  return value.length <= TRANSLATION_INPUT_LIMIT ? value : `${value.slice(0, TRANSLATION_INPUT_LIMIT)}\n${OMITTED_MARKER}`;
}

export { OMITTED_MARKER, TRANSLATION_INPUT_LIMIT };
