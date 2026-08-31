const BLANK = "＿＿＿＿";
const HSPACE = "[ \\t　]*";
const spaced = (word: string) => [...word].join(HSPACE);
const BANK_LABELS = ["金融機関名", "銀行名", "支店名", "口座番号", "口座名義", "口座種別", "預金種別"];
const BANK_LABEL = new RegExp(`(${BANK_LABELS.map(spaced).join("|")})(?:${HSPACE}[（(]${HSPACE}${spaced("カナ")}${HSPACE}[）)])?${HSPACE}[:：]`, "gu");
const isNarrative = (text: string) => /[。、「」]|裁判所|(?:する|した|され|しなければ|ものと|こと|場合|及び|又は|または|によ|につ|にお|にて|として|支払|義務|同意|合意)/.test(text);
const BANK_VALUE_PATTERNS: Record<string, RegExp> = {
  金融機関名: /^[\p{L}\p{N}〇○・ー（）() \t　]+?(?:銀行|信用金庫|信用組合|農業協同組合)/u,
  銀行名: /^[\p{L}\p{N}〇○・ー（）() \t　]+?(?:銀行|信用金庫|信用組合|農業協同組合)/u,
  支店名: /^(?:[\p{L}\p{N}〇○・ー \t　]+?(?:支店|出張所|営業部)|本店)/u,
  口座番号: /^[\d０-９_＿][\d０-９_＿ \t　-]*/u,
  口座名義: /^[\p{L}\p{N}〇○・ー＿_()（）．.＆& \t　]+/u,
};

function bankValue(value: string, label: string) {
  if (!value.trim() || isNarrative(value)) return value;
  if (label === "口座種別" || label === "預金種別") return value;
  // 項目の値の範囲だけを置換する。銀行名の後ろに続く条文まで食べない。
  const trimmed = value.trim();
  const match = BANK_VALUE_PATTERNS[label]?.exec(trimmed);
  // 末尾に説明文などがある場合は曖昧なので保持する。
  return match && match[0].trim() === trimmed ? BLANK : value;
}

export function maskBankAccountFields(source: string) {
  let pendingLabel = "";
  return source.split("\n").map((line) => {
    const fields = [...line.matchAll(BANK_LABEL)];
    if (!fields.length) {
      const pending = pendingLabel;
      pendingLabel = "";
      if (pending) return bankValue(line, pending);
      // 項目名のない、金融機関名だけの独立した行。
      return bankValue(line, "金融機関名");
    }
    pendingLabel = "";
    return line.slice(0, fields[0].index) + fields.map((field, index) => {
      const end = fields[index + 1]?.index ?? line.length;
      const value = line.slice(field.index! + field[0].length, end);
      const label = field[1].replace(/[ \t　]/g, "");
      const kana = /[（(]/.test(field[0]) ? "（カナ）" : "";
      if (index === fields.length - 1 && !value.trim()) pendingLabel = label;
      return `${label}${kana}：${bankValue(value, label).trim()}${index < fields.length - 1 ? " " : ""}`;
    }).join("");
  }).join("\n");
}

const CLOSING = /以上[、，,][ \t　]*(?=本契約|甲乙)|以上の約定成立の証として|本契約締結の証として/;
const SHORT_CLOSING = /本(?:書|契約書)[ \t　]*[一二三四五六七八九十\d０-９]+[ \t　]*通を作成し|(?:甲乙)?記名押印の(?:上|うえ)(?=[^\n]*(?:保有|保管|保存))/;
export const isClosingStatement = (text: string) => CLOSING.exec(text)?.index === 0 || SHORT_CLOSING.exec(text)?.index === 0;
export const isSigningField = (text: string) => /^(?:(?:契約)?締結日[ \t　]*[:：]|[（(]?[甲乙丙][）)]?[ \t　]*[:：]|[甲乙丙][ \t　]*[（(]住[ \t　]*所[）)]|(?:[（(]?[甲乙丙][）)]?[ \t　]*)?(?:住[ \t　]*所|所在地)[ \t　]*[:：])/.test(text);

export function splitTemplateBoundaries(source: string) {
  return source.split("\n").map((line) => {
    // 締め文内の「本書2通…」「記名押印…」は再分割しない。
    const closing = CLOSING.exec(line) ?? SHORT_CLOSING.exec(line);
    const text = closing && closing.index > 0 ? line.slice(0, closing.index) + "\n" + line.slice(closing.index) : line;
    return text.replace(/((?:契約)?締結日[ \t　]*[:：]|[甲乙丙][ \t　]*[:：])/g, "\n$1");
  }).join("\n");
}

const addressField = /^((?:[（(]?[甲乙丙][）)]?[ \t　]*[:：]?[ \t　]*)?(?:住[ \t　]*所|所在地)[ \t　]*[:：]|[甲乙丙][ \t　]*[:：]|[甲乙丙][ \t　]*[（(]住[ \t　]*所[）)])[ \t　]*(.*)$/;
const identityLine = /(?:株式会社|合同会社|有限会社|代表取締役|代表社員|代表者|社[ \t　]*名[ \t　]*[:：]|会社名[ \t　]*[:：])/;
const addressNumber = /(?:[\d０-９]+[ \t　]*[-－−ー‐][ \t　]*[\d０-９]+|[一二三四五六七八九十\d０-９]+[ \t　]*丁目|[\d０-９]+[ \t　]*番[地 \t　]*[\d０-９]+)/;
const building = /ビル|マンション|ハイツ|レジデンス|[\d０-９]+[ \t　]*(?:号|階|[FＦ])|[ァ-ヶー]{2,}.*[\d０-９]+/;
const addressCharacters = /^[\p{L}\p{N}〇○々・ー－−‐\-〒（）() \t　]+$/u;
const literalAddress = (line: string) => addressCharacters.test(line) && addressNumber.test(line) &&
  /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(line) &&
  /[\p{Script=Han}]/u.test(line) && !/契約|条件|商品|番号|手数料|コード|条項/.test(line);

export function maskAddressFields(source: string) {
  let continuation = false;
  return source.split("\n").map((sourceLine) => {
    const line = sourceLine.trim();
    const field = addressField.exec(line);
    if (field) {
      const value = field[2];
      if (isNarrative(value) || /[「」]/.test(value)) { continuation = false; return sourceLine; }
      const identityIndex = value.search(identityLine);
      const addressValue = identityIndex >= 0 ? value.slice(0, identityIndex).trim() : value;
      const explicitAddress = /住所|所在地/.test(field[1].replace(/[ \t　]/g, ""));
      const addressLike = literalAddress(addressValue) || building.test(addressValue) || /^〒/.test(addressValue) ||
        /^[ァ-ヶー]{2,}[\p{L}\p{N}・ー \t　]*$/u.test(addressValue) || /^[\p{Script=Han}]+[市区町村]$/u.test(addressValue);
      if (addressValue && !explicitAddress && !addressLike && !/^[_＿\s]+$/.test(addressValue)) {
        continuation = false;
        return sourceLine;
      }
      continuation = true;
      // 役職＋人名の判定はCodex-253bに任せる。
      if (identityIndex === 0) return sourceLine;
      if (identityIndex > 0) return field[1].replace(/[ \t　]/g, "") + BLANK + "\n" + value.slice(identityIndex);
      return field[1].replace(/[ \t　]/g, "") + BLANK;
    }
    if (!line) return sourceLine;
    if (identityLine.test(line) || isNarrative(line) || isClosingStatement(line) || isSigningField(line) || /^[第（(①-⑳]/.test(line)) {
      continuation = false;
      return sourceLine;
    }
    const party = /^([甲乙丙])[ \t　]+(.+)$/.exec(line);
    if (party && literalAddress(party[2])) { continuation = true; return `${party[1]}：${BLANK}`; }
    // 裸の地名は対象外。番地がある住所行、または住所欄直後の建物名行に限定する。
    const literal = addressCharacters.test(line);
    const address = literalAddress(line);
    const addressContinuation = continuation && literal && (building.test(line) || /^[ァ-ヶー]{2,}[\p{L}\p{N}・ー \t　]*$/u.test(line));
    if (address || addressContinuation) { continuation = true; return BLANK; }
    continuation = false;
    return sourceLine;
  }).join("\n");
}
