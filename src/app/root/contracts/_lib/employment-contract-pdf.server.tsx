import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { CompanySeal } from "@/app/system/mypage/_lib/company-seal-pdf";
import { employmentContractRows } from "./employment-contract-templates";
import {
  jaWrap,
  registerFonts,
} from "@/app/system/mypage/_lib/todoke-pdf.server";
import {
  CONTRACT_TEXT,
  contractDefaults,
  type EmploymentContractPayload,
} from "./employment-contract";

export type EmploymentContractPdfData = EmploymentContractPayload & {
  companySeal?: string;
  employmentType?: string;
  companyName: string;
  representative: string;
  companyAddress: string;
  employeeName: string;
};
const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 10.3,
    lineHeight: 1.7,
    paddingTop: 36,
    paddingHorizontal: 38,
    paddingBottom: 28,
    color: "#111",
  },
  header: {
    position: "absolute",
    top: 14,
    left: 38,
    color: "#999",
    fontSize: 7.5,
  },
  revision: { textAlign: "right", marginBottom: 8 },
  title: {
    fontSize: 13,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 14,
  },
  section: {
    backgroundColor: "#e8e8e8",
    borderWidth: 0.6,
    borderColor: "#555",
    fontWeight: 700,
    textAlign: "center",
    padding: 4,
    marginVertical: 12,
  },
  para: { marginBottom: 6.5 },
  signature: { marginLeft: 230, marginVertical: 16 },
  sigRow: { flexDirection: "row", marginBottom: 12 },
  sigLabel: { width: 95 },
  sigValue: {
    width: 194,
    borderBottomWidth: 0.6,
    paddingLeft: 3,
    flexDirection: "row",
  },
  seal: { marginLeft: 10 },
  company: { marginLeft: 275, marginVertical: 10 },
  table: {
    borderTopWidth: 0.6,
    borderLeftWidth: 0.6,
    borderRightWidth: 0.6,
    borderColor: "#555",
  },
  row: { flexDirection: "row", borderBottomWidth: 0.6, borderColor: "#555" },
  label: {
    width: 112,
    borderRightWidth: 0.6,
    borderColor: "#555",
    padding: 7,
    fontWeight: 700,
  },
  body: { flex: 1, padding: 7 },
  shift: {
    marginVertical: 3,
    borderTopWidth: 0.5,
    borderLeftWidth: 0.5,
    borderColor: "#777",
  },
  shiftRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#777",
  },
  shiftCell: {
    flex: 1,
    borderRightWidth: 0.5,
    borderColor: "#777",
    padding: 2,
    textAlign: "center",
  },
  pageNo: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
  },
  spacer: { height: 3 },
});
const d = (v: string) => {
  const [y, m, day] = v.split("-").map(Number);
  return y && m && day ? `${y}年${m}月${day}日` : v;
};
const W = ({ children, units = 48 }: { children: string; units?: number }) => (
  <Text>{jaWrap(children, units)}</Text>
);
function Header({ name, page }: { name: string; page: number }) {
  return (
    <>
      <Text style={s.header}>{jaWrap(name, 60)}</Text>
      <Text style={s.pageNo}>{page}</Text>
    </>
  );
}
function Section({ children }: { children: string }) {
  return <Text style={s.section}>{jaWrap(children, 60)}</Text>;
}
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.row} wrap={false}>
      <Text style={s.label}>{jaWrap(label, 8)}</Text>
      <View style={s.body}>{children}</View>
    </View>
  );
}
function Shift() {
  return (
    <View style={s.shift}>
      <View style={s.shiftRow}>
        {["シフト", "始業", "就業", "休憩時間"].map((x) => (
          <Text key={x} style={s.shiftCell}>
            {jaWrap(x, 12)}
          </Text>
        ))}
      </View>
      {[
        ["A", "14時00分", "21時00分", "45分"],
        ["B", "9時00分", "21時00分", "60分"],
        ["C", "9時00分～17時00分", "左記時間の4時間後", "45分"],
      ].map((r) => (
        <View key={r[0]} style={s.shiftRow}>
          {r.map((x, i) => (
            <Text key={i} style={s.shiftCell}>
              {jaWrap(x, 14)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
function Address({ value }: { value: string }) {
  const m = value.trim().match(/^(〒\d{3}-\d{4})\s*(.*)$/);
  return (
    <View style={s.company}>
      <W units={21}>{m?.[1] ?? ""}</W>
      <W units={21}>{m ? m[2] : value}</W>
    </View>
  );
}
const jobs = {
  sales: "営業職",
  office: "事務職",
  tech: "技術職",
  other: "その他",
} as const;
export function EmploymentContractPdfDocument({
  data,
}: {
  data: EmploymentContractPdfData;
}): React.ReactElement<DocumentProps> {
  registerFonts();
  const templateType=data.templateType ?? (data.salaryKind === "monthly" ? "full_time" : "part_time");
  if (templateType !== "part_time") return <EmployeeDocument data={{...contractDefaults(templateType),...data,templateType}} />;
  const jobLine = (Object.entries(jobs) as [keyof typeof jobs, string][])
    .map(
      ([k, v]) =>
        `${data.jobType === k ? "✓" : "□"} ${v}${k === "other" ? `：［ ${data.jobTypeOther || ""} ］` : ""}`,
    )
    .join(" /  ");
  return (
    <Document title="雇用契約書 兼 労働条件通知書" author="Garden">
      <Page size="A4" style={s.page}>
        <Header name={data.companyName} page={1} />
        <Text style={s.revision}>
          {jaWrap("2026年　4月　20日　改定 ver.2", 60)}
        </Text>
        <Text style={s.title}>
          {jaWrap(
            `労働条件通知書 兼 雇用契約書（ ${data.kind === "new" ? "✓" : "□"}新規　${data.kind === "renewal" ? "✓" : "□"}更新 ）`,
            60,
          )}
        </Text>
        <Section>〔雇用契約書〕</Section>
        {data.employmentType && <Text style={s.para}>{jaWrap(`雇用形態：${data.employmentType}`, 45)}</Text>}
        <Text style={s.para}>
          {jaWrap(
            `　${data.companyName}（以下、甲という）と[ ${data.employeeName} ]（以下、乙という）とは、次の通り雇用契約を締結する。`,
            45,
          )}
        </Text>
        {CONTRACT_TEXT.agreement.map((x) => (
          <Text key={x} style={s.para}>
            {jaWrap(x, 45)}
          </Text>
        ))}
        <Text style={s.para}>
          {jaWrap(
            "本書に記載の各条項を確認・理解した上で、労働条件を承諾し署名いたします。",
            45,
          )}
        </Text>
        <View style={s.signature}>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>{jaWrap("通知日及び締結日：", 10)}</Text>
            <View style={s.sigValue}>
              <W>{d(data.concludedOn)}</W>
            </View>
          </View>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>{jaWrap("住所：", 20)}</Text>
            <View style={s.sigValue}>
              {data.employeeAddress ? (
                <W units={17}>{data.employeeAddress}</W>
              ) : null}
            </View>
          </View>
          <View style={s.sigRow}>
            <Text style={s.sigLabel}>{jaWrap("署名：", 20)}</Text>
            <View style={s.sigValue}>
              <W>{data.employeeName}</W>
              <Text style={s.seal}>㊞</Text>
            </View>
          </View>
        </View>
        <Section>〔労働条件通知書〕</Section>
        <Address value={data.companyAddress} />
        <View style={{position:"relative"}}><Text style={s.company}>
          {jaWrap(
            `${data.companyName}　代表取締役　${data.representative}　㊞`,
            21,
          )}
        </Text><CompanySeal src={data.companySeal} /></View>
        <Text style={s.para}>
          {jaWrap("貴殿の労働条件は次の通りです。", 62)}
        </Text>
        <View style={s.table}>
          <Row label="契約期間">
            <W>{data.indefinite ? `期間の定めなし　${d(data.contractStart)} から` : `［ ${d(data.contractStart)} ］ ～ ［ ${d(data.contractEnd)} ］`}</W>
          </Row>
          <Row label="契約更新">
            <W units={34}>{data.renewalText ?? CONTRACT_TEXT.renewal}</W>
          </Row>
          <Row label="契約更新基準">
            <W units={34}>{CONTRACT_TEXT.renewalCriteria}</W>
          </Row>
          <Row label="試用期間">
            <W units={34}>{CONTRACT_TEXT.trial}</W>
          </Row>
        </View>
      </Page>
      <Page size="A4" style={s.page}>
        <Header name={data.companyName} page={2} />
        <View style={s.table}>
          <Row label="就業場所">
            <W units={34}>{data.workLocation}</W>
          </Row>
          <Row label="従事すべき業務の内容">
            <W units={34}>{jobLine}</W>
          </Row>
          <Row label="始業、終業の時刻、休憩時間、休日、所定時間外労働の 有無に関する事項">
            <View>
              {CONTRACT_TEXT.work.slice(0, 1).map((x) => (
                <W key={x} units={34}>
                  {x}
                </W>
              ))}
              <Shift />
              {CONTRACT_TEXT.work.slice(1).map((x) => (
                <Text key={x} style={s.para}>
                  {jaWrap(x, 34)}
                </Text>
              ))}
            </View>
          </Row>
          <Row label="賃金および支払方法">
            <W
              units={34}
            >{`1. 基本賃金　時給 ［ ${data.hourlyWage.toLocaleString("ja-JP")} ］ 円（大阪府最低賃金額に準ずる）`}</W>
            {CONTRACT_TEXT.wage.slice(0, 4).map((x) => (
              <Text key={x} style={s.para}>
                {jaWrap(data.commuteCap !== undefined ? x.replace("20,000",data.commuteCap.toLocaleString("ja-JP")) : x, 34)}
              </Text>
            ))}
          </Row>
        </View>
      </Page>
      <Page size="A4" style={s.page}>
        <Header name={data.companyName} page={3} />
        <View style={s.table}>
          <Row label="">
            <View>
              {CONTRACT_TEXT.wage.slice(4).map((x) => (
                <Text key={x} style={s.para}>
                  {jaWrap(x, 34)}
                </Text>
              ))}
            </View>
          </Row>
          <Row label="その他">
            <View>
              {CONTRACT_TEXT.other.map((x) => (
                <Text key={x} style={s.para}>
                  {jaWrap(x, 34)}
                </Text>
              ))}
            </View>
          </Row>
        </View>
        <Text style={{ marginTop: 8 }}>{jaWrap("以下、余白とする。", 48)}</Text>
      </Page>
    </Document>
  );
}
// Template spacing uses full-width blanks, which jaWrap counts as half-width.
// Normalize those blanks before applying the same explicit wrapping as part-time.
const EmployeeW = ({children, units = 45}: {children: string; units?: number}) => (
  <W units={units}>{children.replaceAll("　", " ")}</W>
);
function EmployeeDocument({data}: {data: EmploymentContractPdfData}) {
 const rows=employmentContractRows(data);
 return <Document title="雇用契約書 兼 労働条件通知書" author="Garden">
  <Page size="A4" style={s.page}>
   <Header name={data.companyName} page={1}/>
   <Text style={s.title}>{jaWrap("労働条件通知書 兼 雇用契約書",60)}</Text>
   <Section>〔雇用契約書〕</Section>
   <EmployeeW units={45}>{`${data.companyName}（以下「甲」という）と ${data.employeeName}（以下「乙」という）は、以下の条件に基づき雇用契約を締結する。`}</EmployeeW>
   <EmployeeW units={45}>以上の合意を証するため本契約書を2通作成し、甲乙の両当事者記名（又は署名）捺印の上、各々1通を保有する。</EmployeeW>
   <View style={s.signature}><EmployeeW>{`締結日：${d(data.concludedOn)}`}</EmployeeW><EmployeeW>{`住所：${data.employeeAddress}`}</EmployeeW><EmployeeW>{`氏名：${data.employeeName}　㊞`}</EmployeeW></View>
   <Section>〔労働条件通知書〕</Section>
   <Address value={data.companyAddress}/>
   <View style={{position:"relative"}}><View style={s.company}><W units={21}>{data.companyName}</W><W units={21}>{`代表取締役　${data.representative}　㊞`}</W></View><CompanySeal src={data.companySeal}/></View>
   <View style={s.table}>{rows.slice(0,4).map(r=><Row key={r.label} label={r.label}><EmployeeW units={34}>{r.text}</EmployeeW></Row>)}</View>
  </Page>
  <Page size="A4" style={s.page}><Header name={data.companyName} page={2}/><View style={s.table}>
   {rows.slice(4,6).map(r=><Row key={r.label} label={r.label}><EmployeeW units={34}>{r.text}</EmployeeW></Row>)}
   <Row label={rows[6].label}><EmployeeW units={34}>{rows[6].text.split("3.　所定外")[0]}</EmployeeW></Row>
  </View></Page>
  <Page size="A4" style={s.page}><Header name={data.companyName} page={3}/><View style={s.table}>
   <Row label="賃金（続き）"><EmployeeW units={34}>{"3.　所定外"+rows[6].text.split("3.　所定外")[1]}</EmployeeW></Row>
   {rows.slice(7).map(r=><Row key={r.label} label={r.label}><EmployeeW units={34}>{r.text}</EmployeeW></Row>)}
  </View><Text style={{marginTop:8}}>{jaWrap("以下、余白とする。",48)}</Text></Page>
 </Document>;
}
export async function renderEmploymentContractPdf(
  data: EmploymentContractPdfData,
) {
  return renderToBuffer(<EmploymentContractPdfDocument data={data} />);
}
