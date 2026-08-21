import path from "node:path";
import { Document, G, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { openSync } from "fontkit";
import type { CallMetricsResponse, EmployeeCallMetricRow, CallMetricRow } from "./call-metrics";
import { formatCallsPerWorkHour, formatWorkTime } from "./call-metrics";

const COLORS = { bg: "#F4F5F7", card: "#FFFFFF", line: "#E3EAF3", navy: "#10233F", teal: "#0EA5A0", ink: "#17212E", sub: "#5A6B80", zero: "#98A4B3" } as const;
type VectorFont = ReturnType<typeof openSync>;
let regularFont: VectorFont | null = null;
let boldFont: VectorFont | null = null;
function fonts() {
  const dir = path.join(process.cwd(), "public", "fonts");
  regularFont ??= openSync(path.join(dir, "ZenKakuGothicNew-Regular.ttf"));
  boldFont ??= openSync(path.join(dir, "ZenKakuGothicNew-Bold.ttf"));
  return { regular: regularFont, bold: boldFont };
}

type TextAlign = "left" | "center" | "right";
function VectorText({ children, width, height = 22, fontSize = 7.5, bold = false, align = "right", color = COLORS.ink, fixed = false }: {
  children: string; width: number; height?: number; fontSize?: number; bold?: boolean; align?: TextAlign; color?: string; fixed?: boolean;
}) {
  const font = (bold ? fonts().bold : fonts().regular) as Exclude<VectorFont, { fonts: unknown }>;
  const run = font.layout(children);
  const scale = fontSize / font.unitsPerEm;
  const textWidth = run.positions.reduce((sum, position) => sum + position.xAdvance * scale, 0);
  let cursor = align === "left" ? 3 : align === "center" ? (width - textWidth) / 2 : width - textWidth - 3;
  const baseline = (height + fontSize) / 2 - 1;
  return <Svg fixed={fixed} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    {run.glyphs.map((glyph, index) => {
      const position = run.positions[index];
      const x = cursor + position.xOffset * scale;
      cursor += position.xAdvance * scale;
      return <G key={index} transform={`translate(${x} ${baseline - position.yOffset * scale}) scale(${scale} ${-scale})`}><Path d={glyph.path.toSVG()} fill={color}/></G>;
    })}
  </Svg>;
}

function VectorParagraph({ children, width, fontSize = 7.5, bold = false, color = COLORS.ink }: {
  children: string; width: number; fontSize?: number; bold?: boolean; color?: string;
}) {
  const limit = Math.max(1, Math.floor((width - 6) / fontSize));
  const lines = Array.from({ length: Math.ceil(children.length / limit) || 1 }, (_, index) => children.slice(index * limit, (index + 1) * limit));
  return <View style={{ width, paddingVertical: 3 }}>{lines.map((line, index) => <VectorText key={index} width={width} height={fontSize + 3} fontSize={fontSize} bold={bold} align="left" color={color}>{line}</VectorText>)}</View>;
}

const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 42, paddingHorizontal: 28, backgroundColor: COLORS.bg, color: COLORS.ink, fontSize: 7.5 },
  header: { position: "absolute", top: 20, left: 28, right: 28, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: COLORS.teal, flexDirection: "row", justifyContent: "space-between" },
  headerTitle: { color: COLORS.navy, fontSize: 11, fontWeight: 700 },
  headerPeriod: { color: COLORS.sub, fontSize: 8 },
  footer: { position: "absolute", bottom: 17, left: 28, right: 28, color: COLORS.sub, fontSize: 7, textAlign: "right" },
  sectionTitle: { marginBottom: 8, color: COLORS.navy, fontSize: 15, fontWeight: 700 },
  accent: { width: 32, height: 3, marginBottom: 12, backgroundColor: COLORS.teal },
  table: { width: "100%", borderTopWidth: 1, borderLeftWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card },
  row: { flexDirection: "row", minHeight: 22 },
  th: { paddingVertical: 6, paddingHorizontal: 3, backgroundColor: COLORS.navy, color: "#FFFFFF", borderRightWidth: 1, borderBottomWidth: 1, borderColor: COLORS.line, textAlign: "right", fontWeight: 700 },
  thCenter: { textAlign: "center" },
  thLeft: { textAlign: "left" },
  td: { paddingVertical: 5, paddingHorizontal: 3, borderRightWidth: 1, borderBottomWidth: 1, borderColor: COLORS.line, textAlign: "right" },
  tdLeft: { textAlign: "left" },
  zero: { color: COLORS.zero },
  strong: { color: COLORS.ink, fontWeight: 700 },
  definitionBlock: { marginBottom: 16 },
  definitionTitle: { marginBottom: 5, color: COLORS.navy, fontSize: 11, fontWeight: 700 },
});

type Column<T> = { label: string; width: number; value: (row: T) => string; align?: "left" | "center"; emphasized?: (row: T) => "zero" | "strong" | null };
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
export const callMetricCountTone = (value: number) => value === 0 ? "zero" as const : "strong" as const;

const employeeColumns: Column<EmployeeCallMetricRow>[] = [
  { label: "社員名", width: 92, value: (r) => r.employeeName, align: "left" },
  { label: "稼働時間", width: 58, value: (r) => formatWorkTime(r.workSeconds) },
  { label: "コール数", width: 43, value: (r) => r.callCount.toLocaleString("ja-JP") },
  { label: "コール数/h", width: 46, value: (r) => formatCallsPerWorkHour(r.callCount, r.workSeconds) },
  { label: "有効数", width: 39, value: (r) => r.effectiveCount.toLocaleString("ja-JP") },
  { label: "有効率", width: 42, value: (r) => pct(r.effectiveRate) },
  { label: "トス数", width: 37, value: (r) => String(r.tossCount), emphasized: (r) => callMetricCountTone(r.tossCount) },
  { label: "トス率", width: 41, value: (r) => pct(r.callCount ? r.tossCount / r.callCount : 0) },
  { label: "受注数", width: 39, value: (r) => String(r.acquiredCount), emphasized: (r) => callMetricCountTone(r.acquiredCount) },
  { label: "前確OK数", width: 46, value: (r) => String(r.orderCount), emphasized: (r) => callMetricCountTone(r.orderCount) },
  { label: "見込", width: 34, value: (r) => String(r.prospectCount) },
  { label: "担不", width: 34, value: (r) => String(r.absentCount) },
  { label: "留守", width: 34, value: (r) => String(r.awayCount) },
  { label: "無効", width: 34, value: (r) => String(r.invalidCount) },
];

const listColumns: Column<CallMetricRow>[] = [
  { label: "リスト名", width: 128, value: (r) => r.listName, align: "left" },
  { label: "コール数", width: 48, value: (r) => String(r.callCount) },
  { label: "有効数", width: 45, value: (r) => String(r.effectiveCount) },
  { label: "有効率", width: 46, value: (r) => pct(r.effectiveRate) },
  { label: "トス数", width: 43, value: (r) => String(r.tossCount), emphasized: (r) => callMetricCountTone(r.tossCount) },
  { label: "トス率", width: 46, value: (r) => pct(r.callCount ? r.tossCount / r.callCount : 0) },
  { label: "受注数", width: 43, value: (r) => String(r.acquiredCount), emphasized: (r) => callMetricCountTone(r.acquiredCount) },
  { label: "受注率", width: 46, value: (r) => pct(r.callAcquiredRate) },
  { label: "前確OK数", width: 51, value: (r) => String(r.orderCount), emphasized: (r) => callMetricCountTone(r.orderCount) },
  { label: "前確OK率", width: 51, value: (r) => pct(r.callOrderRate) },
  { label: "リスト数", width: 48, value: () => "未取得" },
  { label: "回転数", width: 43, value: () => "未取得" },
  { label: "リスト受注率", width: 57, value: () => "未取得" },
];

const BREAKS = [["1", "11:15", "11:30", "15分"], ["2", "13:00", "14:00", "60分"], ["3", "15:20", "15:30", "10分"], ["4", "16:45", "17:00", "15分"], ["5", "18:20", "18:30", "10分"], ["6", "19:50", "20:00", "10分"], ["合計", "", "", "2時間"]];
const FLAG_RULES = [["留守", "無効"], ["無効", "無効"], ["担不", "有効"], ["見込", "有効"], ["獲得", "有効"], ["トス", "有効"], ["NG", "有効"], ["前確OK", "有効"], ["前確NG", "有効"]];
const DEFINITIONS = [
  ["コール数", "架電回数"], ["有効", "会話できたコール。留守・無効・空白（無効扱い）を除きます。"], ["有効率", "有効数 ÷ コール数"],
  ["トス数", "結果フラグが「トス」のコール"], ["受注数", "結果フラグが「獲得」のコール"], ["前確OK数", "結果フラグが「前確OK」のコール"],
  ["稼働時間", "その日の最初のコールから最後のコールまでの時間から、所定の休憩時間を引いた実働時間です。"],
  ["コール数/h", "コール数 ÷ 稼働時間（時間）。1時間あたり何件かけたかです。"], ["見込", "結果フラグが「見込」のコール"],
  ["担不", "結果フラグが「担不」（担当者不在）のコール"], ["留守", "結果フラグが「留守」のコール"], ["無効", "結果フラグが「無効」のコール"],
  ["リスト絞り込み時の稼働時間", "リストで絞り込んだ場合、稼働時間はそのリストを架電していた時間の幅になります。"],
];

function Chrome({ data }: { data: CallMetricsResponse }) {
  const period = `対象期間 ${data.from}〜${data.to}`;
  return <><View fixed style={styles.header}><VectorText fixed width={350} height={18} fontSize={11} bold align="left" color={COLORS.navy}>テレマ コール集計ポータル</VectorText><VectorText fixed width={250} height={18} fontSize={8} align="right" color={COLORS.sub}>{period}</VectorText></View><Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></>;
}

function DataTable<T>({ columns, rows, employeeHeader = false }: { columns: Column<T>[]; rows: T[]; employeeHeader?: boolean }) {
  return <View style={styles.table}>
    <View fixed style={styles.row}>{columns.map((column, index) => <View key={column.label} style={[styles.th, { width: column.width }]}><VectorText width={column.width} height={22} bold align={employeeHeader && index === 0 ? "center" : column.align ?? "right"} color="#FFFFFF">{column.label}</VectorText></View>)}</View>
    {rows.length ? rows.map((row, rowIndex) => <View key={rowIndex} wrap={false} style={styles.row}>{columns.map((column) => {
      const emphasis = column.emphasized?.(row);
      return <View key={column.label} style={[styles.td, { width: column.width }]}><VectorText width={column.width} height={22} bold={emphasis === "strong"} align={column.align ?? "right"} color={emphasis === "zero" ? COLORS.zero : COLORS.ink}>{column.value(row)}</VectorText></View>;
    })}</View>) : <View style={styles.row}><View style={[styles.td, { width: columns.reduce((sum, c) => sum + c.width, 0) }]}><VectorText width={columns.reduce((sum, c) => sum + c.width, 0)} align="left">対象データがありません</VectorText></View></View>}
  </View>;
}

function SimpleTable({ headers, rows, widths }: { headers: string[]; rows: string[][]; widths: number[] }) {
  return <View style={styles.table}><View fixed style={styles.row}>{headers.map((h, i) => <View key={h} style={[styles.th, { width: widths[i] }]}><VectorText width={widths[i]} height={22} bold align="left" color="#FFFFFF">{h}</VectorText></View>)}</View>{rows.map((row, i) => <View key={i} wrap={false} style={styles.row}>{row.map((cell, j) => <View key={j} style={[styles.td, { width: widths[j] }]}><VectorParagraph width={widths[j]}>{cell}</VectorParagraph></View>)}</View>)}</View>;
}

function SectionTitle({ children }: { children: string }) { return <><VectorText width={400} height={24} fontSize={15} bold align="left" color={COLORS.navy}>{children}</VectorText><View style={styles.accent} /></>; }
function DefinitionTitle({ children }: { children: string }) { return <VectorText width={650} height={20} fontSize={11} bold align="left" color={COLORS.navy}>{children}</VectorText>; }

export function CallMetricsPdfDocument({ data }: { data: CallMetricsResponse }): React.ReactElement<DocumentProps> {
  return <Document title="テレマ コール集計ポータル" author="Garden">
    <Page size="A3" orientation="portrait" wrap style={styles.page}><Chrome data={data}/><SectionTitle>従業員ごと</SectionTitle><DataTable columns={employeeColumns} rows={data.employeeMetrics} employeeHeader/></Page>
    <Page size="A3" orientation="portrait" wrap style={styles.page}><Chrome data={data}/><SectionTitle>リストごと</SectionTitle><DataTable columns={listColumns} rows={data.metrics}/></Page>
    <Page size="A3" orientation="portrait" wrap style={styles.page}><Chrome data={data}/><SectionTitle>定義方法</SectionTitle>
      <View style={styles.definitionBlock}><DefinitionTitle>集計の定義</DefinitionTitle><SimpleTable headers={["指標", "定義"]} rows={DEFINITIONS} widths={[155, 580]}/></View>
      <View style={styles.definitionBlock}><DefinitionTitle>休憩時間割</DefinitionTitle><SimpleTable headers={["回", "開始", "終了", "長さ"]} rows={BREAKS} widths={[100, 170, 170, 170]}/></View>
      <View style={styles.definitionBlock}><DefinitionTitle>コール履歴のフラグ名 → ポータル表示名</DefinitionTitle><SimpleTable headers={["コール履歴", "ポータル表示"]} rows={[["獲得", "受注数"], ["前確OK", "前確OK数"], ["トス", "トス数"]]} widths={[240, 370]}/></View>
    </Page>
    <Page size="A3" orientation="portrait" wrap style={styles.page}><Chrome data={data}/><SectionTitle>定義方法（続き）</SectionTitle>
      <View style={styles.definitionBlock}><DefinitionTitle>結果フラグの扱い（分類ルール）</DefinitionTitle><SimpleTable headers={["結果フラグ", "扱い"]} rows={FLAG_RULES} widths={[240, 370]}/></View>
    </Page>
  </Document>;
}

export const CALL_METRICS_PDF_SECTIONS = ["従業員ごと", "リストごと", "定義方法"] as const;

export function callMetricsPdfFilename(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `テレマコール集計ポータル_${get("year")}${get("month")}${get("day")}_${get("hour")}00.pdf`;
}

export async function renderCallMetricsPdf(data: CallMetricsResponse) {
  return renderToBuffer(<CallMetricsPdfDocument data={data}/>);
}
