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
  fontsRegistered = true;
}

export const EMERGENCY_CONTACT_CONSENT =
  "私は、入社にあたり、業務時間中の事故・災害、急病その他の緊急事態が発生した際の連絡先として、以下の通り届け出いたします。なお、本届出書に記載した個人情報が、上記の緊急連絡の目的に限り使用されることに同意いたします。また、緊急連絡先として指定した本人に対しても、貴社に連絡先を提出する旨の了解を得ております。";
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
    paddingTop: 54,
    paddingHorizontal: 48,
    paddingBottom: 46,
    lineHeight: 1.75,
    color: "#111",
  },
  revision: { textAlign: "right", fontSize: 9, marginBottom: 4 },
  address: { marginBottom: 30 },
  title: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 28,
  },
  consent: { textAlign: "justify", marginBottom: 25 },
  section: { fontSize: 11.5, marginTop: 9, marginBottom: 6 },
  field: { flexDirection: "row", marginLeft: 28, marginBottom: 16 },
  bullet: { width: 20 },
  label: { width: 170 },
  value: {
    flexGrow: 1,
    borderBottomWidth: 0.7,
    borderBottomColor: "#222",
    paddingLeft: 6,
  },
  footer: { marginLeft: 300, marginTop: 72 },
  footerRow: { flexDirection: "row", marginBottom: 20 },
  footerLabel: { width: 50 },
  footerValue: {
    width: 220,
    borderBottomWidth: 0.7,
    borderBottomColor: "#222",
    paddingLeft: 5,
  },
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
    <View style={styles.field}>
      <Text style={styles.bullet}>●</Text>
      <Text style={styles.label}>{label}：</Text>
      <Text style={styles.value}>{value}</Text>
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
        <Text style={styles.revision}>2026年 4月 1日　改定　ver.1</Text>
        <View style={styles.address}>
          <Text>{data.companyName}</Text>
          <Text>代表取締役　{data.representative}　様</Text>
        </View>
        <Text style={styles.title}>
          緊急連絡先届（ {data.kind === "new" ? "✓" : "□"}新規　
          {data.kind === "change" ? "✓" : "□"}変更 ）
        </Text>
        <Text style={styles.consent}>{EMERGENCY_CONTACT_CONSENT}</Text>
        <Text style={styles.section}>1.　提出者本人</Text>
        <Field label="氏名" value={data.employeeName} />
        <Field label="現住所" value={data.selfAddress} />
        <Field label="個人の電話番号（携帯等）" value={data.selfPhone} />
        <Text style={styles.section}>2.　緊急連絡先</Text>
        <Field label="氏名" value={data.ecName} />
        <Field label="本人との続柄" value={data.ecRelationship} />
        <Field
          label="住所（本人と同一の場合は「同上」と記載）"
          value={data.ecAddress}
        />
        <Field label="電話番号" value={data.ecPhone} />
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>提出日：</Text>
            <Text style={styles.footerValue}>{jstDate(data.submittedAt)}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>署名：</Text>
            <Text style={styles.footerValue}>
              {data.employeeName}　　　　　　　　　㊞
            </Text>
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
