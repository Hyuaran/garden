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
import { NDA_ARTICLES, NDA_CLOSING, NDA_PREAMBLE } from "./nda-content";

let fontsRegistered = false;
export function registerFonts() {
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
const JAPANESE_CHARACTER =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ヵヶ]/u;
const LATIN_OR_NUMBER_RUN = /[\x00-\x7F０-９]+|./gu;
const LINE_START_FORBIDDEN = /^[、。，．）」』】〕〉》・：；！？％]/;
const LINE_END_FORBIDDEN = /[（「『【〔〈《]$/;
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
  // 禁則処理：句読点・閉じ括弧は行頭に置かず前行末へ追い込み、開き括弧は行末に置かず次行頭へ送る
  for (let i = 1; i < lines.length; i++) {
    while (lines[i] && LINE_START_FORBIDDEN.test(lines[i])) {
      lines[i - 1] += lines[i][0];
      lines[i] = lines[i].slice(1);
    }
    while (LINE_END_FORBIDDEN.test(lines[i - 1])) {
      lines[i] = lines[i - 1].slice(-1) + lines[i];
      lines[i - 1] = lines[i - 1].slice(0, -1);
    }
  }
  return lines.filter((l) => l !== "").join("\n");
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
export type NdaPdfData = {
  companyName: string;
  representative: string;
  kind: "new" | "resubmit";
  employeeName: string;
  pledgeDate: string;
  address: string;
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
  ndaPage: {
    fontFamily: "NotoSansJP",
    fontSize: 10.2,
    paddingTop: 44,
    paddingHorizontal: 48,
    paddingBottom: 34,
    lineHeight: 1.7,
    color: "#111",
  },
  ndaRevision: { textAlign: "right", fontSize: 9, minHeight: 16, marginBottom: 2 },
  ndaAddress: { marginBottom: 20 },
  ndaTitle: {
    fontSize: 15,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 24,
  },
  ndaPreamble: { marginBottom: 16 },
  ndaCenter: { textAlign: "center", marginBottom: 16 },
  ndaArticle: { marginBottom: 18 },
  ndaArticleTitle: { fontSize: 10.5, fontWeight: 700, marginBottom: 5 },
  ndaParagraph: { marginBottom: 5 },
  ndaItem: { flexDirection: "row", paddingLeft: 14, marginBottom: 4 },
  ndaItemNo: { width: 18 },
  ndaItemText: { flexGrow: 1 },
  ndaNote: { paddingLeft: 14, marginTop: 1 },
  ndaClosing: { textAlign: "center", marginTop: 28, marginBottom: 20 },
  ndaFooter: { marginLeft: 230 },
  ndaFooterRow: { flexDirection: "row", marginBottom: 16 },
  ndaFooterLabel: { width: 48 },
  ndaFooterValue: {
    width: 215,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.7,
    borderBottomColor: "#222",
    paddingLeft: 5,
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
        <Text style={styles.revision}>
          {jaWrap("2026年 4月 1日　改定　ver.1")}
        </Text>
        <View style={styles.address}>
          <Text>{jaWrap(data.companyName)}</Text>
          <Text>{jaWrap(`代表取締役　${data.representative}　様`)}</Text>
        </View>
        <Text style={styles.title}>
          {jaWrap(
            `緊急連絡先届（ ${data.kind === "new" ? "✓" : "□"}新規　${data.kind === "change" ? "✓" : "□"}変更 ）`,
          )}
        </Text>
        <Text style={styles.consent}>
          {jaWrap(EMERGENCY_CONTACT_CONSENT, 40)}
        </Text>
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
            <View style={styles.footerValue}>
              <Text>{jaWrap(jstDate(data.submittedAt))}</Text>
            </View>
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

function NdaArticle({ article }: { article: (typeof NDA_ARTICLES)[number] }) {
  return (
    <View style={styles.ndaArticle}>
      <Text style={styles.ndaArticleTitle} minPresenceAhead={18}>
        {jaWrap(article.title, 44)}
      </Text>
      {article.paragraphs.map((p) => (
        <Text key={p} style={styles.ndaParagraph}>
          {jaWrap(p, 44)}
        </Text>
      ))}
      {article.items.map((item, index) => (
        <View key={item} style={styles.ndaItem}>
          <Text style={styles.ndaItemNo}>{index + 1}.</Text>
          <Text style={styles.ndaItemText}>{jaWrap(item, 41)}</Text>
        </View>
      ))}
      {"note" in article && article.note ? (
        <Text style={styles.ndaNote}>{jaWrap(article.note, 41)}</Text>
      ) : null}
    </View>
  );
}
function NdaPageNo({ number }: { number: number }) {
  return <Text style={styles.pageNo}>{number}</Text>;
}
export function NdaPdfDocument({
  data,
}: {
  data: NdaPdfData;
}): React.ReactElement<DocumentProps> {
  registerFonts();
  return (
    <Document title="秘密保持に関する誓約書" author="Garden">
      <Page size="A4" style={styles.ndaPage}>
        <Text style={styles.ndaRevision}>
          {jaWrap("2026年　4月　1日　改定 ver.3", 60)}
        </Text>
        <View style={styles.ndaAddress}>
          <Text>{jaWrap(data.companyName, 60)}</Text>
          <Text>{jaWrap(`代表取締役　${data.representative}　様`, 60)}</Text>
        </View>
        <Text style={styles.ndaTitle}>
          {jaWrap(
            `秘密保持に関する誓約書（ ${data.kind === "new" ? "✓" : "□"}新規　${data.kind === "resubmit" ? "✓" : "□"}再提出 ）`,
            60,
          )}
        </Text>
        <Text style={styles.ndaPreamble}>{jaWrap(NDA_PREAMBLE, 44)}</Text>
        <Text style={styles.ndaCenter}>{jaWrap("記")}</Text>
        {NDA_ARTICLES.slice(0, 3).map((article) => (
          <NdaArticle key={article.title} article={article} />
        ))}
        <NdaPageNo number={1} />
      </Page>
      <Page size="A4" style={styles.ndaPage}>
        {NDA_ARTICLES.slice(3).map((article) => (
          <NdaArticle key={article.title} article={article} />
        ))}
        <Text style={styles.ndaClosing}>{jaWrap(NDA_CLOSING, 44)}</Text>
        <View style={styles.ndaFooter}>
          <View style={styles.ndaFooterRow} wrap={false}>
            <Text style={styles.ndaFooterLabel}>{jaWrap("誓約日：")}</Text>
            <View style={styles.ndaFooterValue}>
              <Text>{jaWrap(formatJapaneseDate(data.pledgeDate))}</Text>
            </View>
          </View>
          <View style={styles.ndaFooterRow} wrap={false}>
            <Text style={styles.ndaFooterLabel}>{jaWrap("住所：")}</Text>
            <View style={styles.ndaFooterValue}>
              <Text>{jaWrap(data.address, 19)}</Text>
            </View>
          </View>
          <View style={styles.ndaFooterRow} wrap={false}>
            <Text style={styles.ndaFooterLabel}>{jaWrap("署名：")}</Text>
            <View style={styles.ndaFooterValue}>
              <Text>{jaWrap(data.employeeName, 18)}</Text>
              <Text style={styles.seal}>㊞</Text>
            </View>
          </View>
        </View>
        <NdaPageNo number={2} />
      </Page>
    </Document>
  );
}
function formatJapaneseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? `${year}年${month}月${day}日` : value;
}
export async function renderNdaPdf(data: NdaPdfData) {
  return renderToBuffer(<NdaPdfDocument data={data} />);
}
