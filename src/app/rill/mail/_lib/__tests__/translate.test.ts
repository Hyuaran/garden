import { describe, expect, it } from "vitest";
import { isLikelyNonJapanese, mailBodyText, OMITTED_MARKER, prepareTranslationInput, TRANSLATION_INPUT_LIMIT } from "../translate";

describe("Rill Mail translation rules", () => {
  it("detects English but not Japanese or Japanese-dominant mixed text", () => {
    expect(isLikelyNonJapanese("Thank you for your message. Please review the attached proposal and reply by Friday.")).toBe(true);
    expect(isLikelyNonJapanese("お問い合わせありがとうございます。添付資料をご確認ください。")).toBe(false);
    expect(isLikelyNonJapanese("新しいProjectについて、来週のMeetingで内容を確認します。よろしくお願いいたします。")).toBe(false);
    expect(isLikelyNonJapanese("")).toBe(false);
  });

  it("allows foreign-language mail with a small amount of kana", () => {
    const englishWithJapaneseSignature = `${"Please review the attached document and contact our support team with any questions. ".repeat(5)}よろしくお願いします`;
    expect(isLikelyNonJapanese(englishWithJapaneseSignature)).toBe(true);
  });

  it("detects Korean and Chinese without requiring Latin letters", () => {
    expect(isLikelyNonJapanese("안녕하세요첨부된문서를확인하시고이번주금요일까지답변해주시기바랍니다감사합니다")).toBe(true);
    expect(isLikelyNonJapanese("您好请确认附件中的最新资料并在本周五之前回复相关负责人非常感谢您的协助")).toBe(true);
  });

  it("rejects Japanese, short text, and numbers or symbols only", () => {
    expect(isLikelyNonJapanese("このたびはお問い合わせいただきありがとうございます。添付している資料をご確認いただき、ご不明な点がございましたらお知らせください。")).toBe(false);
    expect(isLikelyNonJapanese("Short English text")).toBe(false);
    expect(isLikelyNonJapanese("1234567890-+= 0987654321 !!!")).toBe(false);
  });

  it("removes HTML before language detection", () => {
    const html = "<style>これは日本語です</style><p>Hello <strong>team</strong>, please review this update.</p><script>日本語</script>";
    expect(mailBodyText(html)).toBe("Hello team , please review this update.");
    expect(isLikelyNonJapanese(html)).toBe(true);
  });

  it("trims only inputs beyond 20,000 characters and marks omission", () => {
    const boundary = "a".repeat(TRANSLATION_INPUT_LIMIT);
    expect(prepareTranslationInput(boundary)).toBe(boundary);
    const trimmed = prepareTranslationInput(`${boundary}b`);
    expect(trimmed.slice(0, TRANSLATION_INPUT_LIMIT)).toBe(boundary);
    expect(trimmed.endsWith(`\n${OMITTED_MARKER}`)).toBe(true);
  });
});
