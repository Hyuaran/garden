import path from "node:path";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";

let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "public", "fonts");
  Font.register({
    family: "NotoSansJP",
    fonts: [
      { src: path.join(dir, "NotoSansJP-Regular.ttf") },
      { src: path.join(dir, "NotoSansJP-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export const EMERGENCY_CONTACT_CONSENT =
  "私は、入社にあたり、業務時間中の事故・災害、急病その他の緊急事態が発生した際の連絡先として、以下の通り届け出いたします。なお、本届出書に記載した個人情報が、上記の緊急連絡の目的に限り使用されることに同意いたします。また、緊急連絡先として指定した本人に対しても、貴社に連絡先を提出する旨の了解を得ております。";
const JAPANESE_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ヵヶ]/u;
const LATIN_OR_NUMBER_RUN = /[\x00-\x7F０-９]+|./gu;
export function jaWrap(text: string, maxUnits = 40) {
  if (!JAPANESE_CHARACTER.test(text)) return text;
  const tokens = text.match(LATIN_OR_NUMBER_RUN) ?? [text];
  const lines: string[] = [];
  let line = "";
  let units = 0;
  for (const token of tokens) {
    const tokenUnits = JAPANESE_CHARACTER.test(token)
      ? 1
      : Math.max(0.5, Array.from(token).length * 0.5);
    if (line && units + tokenUnits > maxUnits) {
      lines.push(line);
      line = token;
      units = tokenUnits;
    } else {
      line += token;
      units += tokenUnits;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}
export type EmergencyContactPdfData = {
  companyName: string;
  representative: string;
  kind: "new" | "change";
  employeeName: string;
  selfAddress: string;
  selfPhone: string;
  ecName: string;
  ecRelationship: string;
  ecAddress: string;
  ecPhone: string;
  submittedAt: Date;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 10.5,
    paddingTop: 42,
    paddingHorizontal: 48,
    paddingBottom: 32,
    lineHeight: 1.55,
    color: "#111",
  },
  revision: { textAlign: "right", fontSize: 9, minHeight: 18, marginBottom: 4 },
  address: { marginBottom: 20 },
  title: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 18,
  },
  consent: { textAlign: "justify", marginBottom: 18 },
  section: { fontSize: 11.5, marginTop: 6, marginBottom: 4 },
  field: { flexDirection: "row", marginLeft: 28, marginBottom: 11 },
  bullet: { width: 20 },
  label: { width: 170 },
  value: {
    flexGrow: 1,
    borderBottomWidth: 0.7,
    borderBottomColor: "#222",
    paddingLeft: 6,
  },
  footer: { marginLeft: 300, marginTop: 38 },
  footerRow: { flexDirection: "row", marginBottom: 14 },
  footerLabel: { width: 50 },
  footerValue: {
    width: 220,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.7,
    borderBottomColor: "#222",
    paddingLeft: 5,
  },
  seal: { marginLeft: 14 },
  pageNo: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 9,
  },
});
const jstDate = (date: Date) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field} wrap={false}>
      <Text style={styles.bullet}>●</Text>
      <Text style={styles.label}>{jaWrap(`${label}：`, 20)}</Text>
      <Text style={styles.value}>{jaWrap(value, 24)}</Text>
    </View>
  );
}
export function EmergencyContactPdfDocument({
  data,
}: {
  data: EmergencyContactPdfData;
}): React.ReactElement<DocumentProps> {
  registerFonts();
  return (
    <Document title="緊急連絡先届" author="Garden">
      <Page size="A4" style={styles.page}>
        <Text style={styles.revision}>{jaWrap("2026年 4月 1日　改定　ver.1")}</Text>
        <View style={styles.address}>
          <Text>{jaWrap(data.companyName)}</Text>
          <Text>{jaWrap(`代表取締役　${data.representative}　様`)}</Text>
        </View>
        <Text style={styles.title}>
          {jaWrap(`緊急連絡先届（ ${data.kind === "new" ? "✓" : "□"}新規　${data.kind === "change" ? "✓" : "□"}変更 ）`)}
        </Text>
        <Text style={styles.consent}>{jaWrap(EMERGENCY_CONTACT_CONSENT, 40)}</Text>
        <Text style={styles.section}>{jaWrap("1.　提出者本人")}</Text>
        <Field label="氏名" value={data.employeeName} />
        <Field label="現住所" value={data.selfAddress} />
        <Field label="個人の電話番号（携帯等）" value={data.selfPhone} />
        <Text style={styles.section}>{jaWrap("2.　緊急連絡先")}</Text>
        <Field label="氏名" value={data.ecName} />
        <Field label="本人との続柄" value={data.ecRelationship} />
        <Field label="住所" value={data.ecAddress} />
        <Field label="電話番号" value={data.ecPhone} />
        <View style={styles.footer}>
          <View style={styles.footerRow} wrap={false}>
            <Text style={styles.footerLabel}>{jaWrap("提出日：")}</Text>
            <View style={styles.footerValue}><Text>{jaWrap(jstDate(data.submittedAt))}</Text></View>
          </View>
          <View style={styles.footerRow} wrap={false}>
            <Text style={styles.footerLabel}>{jaWrap("署名：")}</Text>
            <View style={styles.footerValue}>
              <Text>{jaWrap(data.employeeName, 18)}</Text>
              <Text style={styles.seal}>㊞</Text>
            </View>
          </View>
        </View>
        <Text style={styles.pageNo}>1</Text>
      </Page>
    </Document>
  );
}
export async function renderEmergencyContactPdf(data: EmergencyContactPdfData) {
  return renderToBuffer(<EmergencyContactPdfDocument data={data} />);
}
