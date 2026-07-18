import { describe, expect, it } from "vitest";
import { isLikelyNonJapanese, mailBodyText, OMITTED_MARKER, prepareTranslationInput, TRANSLATION_INPUT_LIMIT } from "../translate";

describe("Rill Mail translation rules", () => {
  it("detects English but not Japanese or Japanese-dominant mixed text", () => {
    expect(isLikelyNonJapanese("Thank you for your message. Please review the attached proposal and reply by Friday.")).toBe(true);
    expect(isLikelyNonJapanese("お問い合わせありがとうございます。添付資料をご確認ください。")).toBe(false);
    expect(isLikelyNonJapanese("新しいProjectについて、来週のMeetingで内容を確認します。よろしくお願いいたします。")).toBe(false);
    expect(isLikelyNonJapanese("")).toBe(false);
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
