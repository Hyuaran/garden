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
  regularFont ??= openSync(path.join(dir, "NotoSansJP-Regular.ttf"));
  boldFont ??= openSync(path.join(dir, "NotoSansJP-Bold.ttf"));
  return { regular: regularFont, bold: boldFont };
}

type TextAlign = "left" | "center" | "right";
function textWidth(font: Exclude<VectorFont, { fonts: unknown }>, value: string, fontSize: number) {
  return font.layout(value).positions.reduce((sum, position) => sum + position.xAdvance * fontSize / font.unitsPerEm, 0);
}

export function measureVectorTextLayout(value: string, width: number, fontSize = 7.5, bold = false, wrap = false) {
  const font = (bold ? fonts().bold : fonts().regular) as Exclude<VectorFont, { fonts: unknown }>;
  const available = Math.max(1, width - 6);
  if (!wrap) {
    const naturalWidth = textWidth(font, value, fontSize);
    const fittedFontSize = naturalWidth > available ? fontSize * available / naturalWidth : fontSize;
    return { lines: [value], fontSize: fittedFontSize, lineWidths: [Math.min(naturalWidth, available)] };
  }
  const lines: string[] = [];
  let line = "";
  for (const character of Array.from(value)) {
    const candidate = line + character;
    if (line && textWidth(font, candidate, fontSize) > available) { lines.push(line); line = character; }
    else line = candidate;
  }
  lines.push(line);
  return { lines, fontSize, lineWidths: lines.map((item) => textWidth(font, item, fontSize)) };
}

function VectorText({ children, width, height = 22, fontSize = 7.5, bold = false, align = "right", color = COLORS.ink, fixed = false, wrap = false }: {
  children: string; width: number; height?: number; fontSize?: number; bold?: boolean; align?: TextAlign; color?: string; fixed?: boolean; wrap?: boolean;
}) {
  const font = (bold ? fonts().bold : fonts().regular) as Exclude<VectorFont, { fonts: unknown }>;
  const layout = measureVectorTextLayout(children, width, fontSize, bold, wrap);
  const lineHeight = layout.fontSize + 3;
  const actualHeight = Math.max(height, layout.lines.length * lineHeight + 4);
  return <Svg fixed={fixed} width={width} height={actualHeight} viewBox={`0 0 ${width} ${actualHeight}`}>
    {layout.lines.flatMap((line, lineIndex) => {
      const run = font.layout(line);
      const scale = layout.fontSize / font.unitsPerEm;
      const lineWidth = layout.lineWidths[lineIndex];
      let cursor = align === "left" ? 3 : align === "center" ? (width - lineWidth) / 2 : width - lineWidth - 3;
      const baseline = 3 + (lineIndex + 1) * lineHeight - 3;
      return run.glyphs.map((glyph, index) => {
        const position = run.positions[index];
        const x = cursor + position.xOffset * scale;
        cursor += position.xAdvance * scale;
        return <G key={`${lineIndex}-${index}`} transform={`translate(${x} ${baseline - position.yOffset * scale}) scale(${scale} ${-scale})`}><Path d={glyph.path.toSVG()} fill={color}/></G>;
      });
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
  page: { paddingTop: 66, paddingBottom: 42, paddingHorizontal: 28, backgroundColor: COLORS.bg, color: COLORS.ink, fontSize: 7.5 },
  header: { position: "absolute", top: 20, left: 28, right: 28, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: COLORS.teal, flexDirection: "row", justifyContent: "space-between" },
  headerTitle: { color: COLORS.navy, fontSize: 11, fontWeight: 700 },
  headerPeriod: { color: COLORS.sub, fontSize: 8 },
  footer: { position: "absolute", bottom: 17, left: 28, right: 28, color: COLORS.sub, fontSize: 7, textAlign: "right" },
  sectionTitle: { marginBottom: 8, color: COLORS.navy, fontSize: 15, fontWeight: 700 },
  accent: { width: 32, height: 3, marginBottom: 12, backgroundColor: COLORS.teal },
  table: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card },
  row: { flexDirection: "row", minHeight: 22 },
  th: { backgroundColor: COLORS.navy, color: "#FFFFFF", borderRightWidth: 1, borderBottomWidth: 1, borderColor: COLORS.line, textAlign: "right", fontWeight: 700 },
  thCenter: { textAlign: "center" },
  thLeft: { textAlign: "left" },
  td: { borderRightWidth: 1, borderBottomWidth: 1, borderColor: COLORS.line, textAlign: "right" },
  tdLeft: { textAlign: "left" },
  zero: { color: COLORS.zero },
  strong: { color: COLORS.ink, fontWeight: 700 },
  definitionBlock: { marginBottom: 16 },
  definitionTitle: { marginBottom: 5, color: COLORS.navy, fontSize: 11, fontWeight: 700 },
  hiddenMarker: { position: "absolute", opacity: 0, fontSize: 1 },
  // 高さは VectorText が返す実寸（fontSize + 3 + 4）以上にすること。
  // 小さいと Svg が縮小されて中央寄せになり、見出しが右にずれる。
  // ヘッダーの区切り線は y=45〜46。cover はそれより下から始めること（線を塗りつぶさないため）。
  continuationLabel: { position: "absolute", top: 47, left: 28, right: 28, height: 16 },
  continuationCover: { position: "absolute", top: 46, left: 27, right: 27, height: 18 },
  continuationCoverFill: { width: 737, height: 18, backgroundColor: COLORS.bg },
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
  ["トス数", "結果フラグが「トス」のコール"], ["受注数", "結果フラグが「獲得」のコール（コール履歴では「獲得」、ポータルでは「受注」と表示）"], ["前確OK数", "結果フラグが「前確OK」のコール"],
  ["稼働時間", "その日の最初のコールから最後のコールまでの時間から、休憩時間（下表）を引いた実働時間です。その休憩の時間帯をまたいで働いていた場合に、その休憩の長さをまるごと引きます（休憩中に架電していても、別の時間に同じ長さの休憩を取っているため引きます）。休憩の途中から働き始めた日・途中で終えた日は、その休憩は引きません。"],
  ["コール数/h", "コール数 ÷ 稼働時間（時間）。1時間あたり何件かけたかです。"], ["見込", "結果フラグが「見込」のコール"],
  ["担不", "結果フラグが「担不」（担当者不在）のコール"], ["留守", "結果フラグが「留守」のコール"], ["無効", "結果フラグが「無効」のコール"],
  ["リスト絞り込み時の稼働時間", "リストで絞り込んだ場合、稼働時間はそのリストを架電していた時間の幅になります。"],
  ["Excel集計表との差", "※ 従来のExcel集計表は休憩を引いていないため、こちらの方が短く出ます。"],
  ["リスト数・回転数・リスト受注率", "リストデータ取込後に対応"],
];

function Chrome({ data }: { data: CallMetricsResponse }) {
  const period = `対象期間 ${data.from}〜${data.to}`;
  const header = <><VectorText width={350} height={18} fontSize={11} bold align="left" color={COLORS.navy}>テレマ コール集計ポータル</VectorText><VectorText width={250} height={18} fontSize={8} align="right" color={COLORS.sub}>{period}</VectorText></>;
  return <><View style={styles.header}>{header}</View><View fixed style={styles.header}>{header}</View><Text fixed style={styles.hiddenMarker}>{`PDF_HEADER ${data.from} ${data.to}`}</Text><Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></>;
}

function DataTable<T>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  return <View style={[styles.table, { width: tableWidth }]}>
    <View fixed style={styles.row}>{columns.map((column) => <View key={column.label} style={[styles.th, { width: column.width }]}><VectorText width={column.width - 1} height={22} bold align="center" color="#FFFFFF">{column.label}</VectorText></View>)}</View>
    {rows.length ? rows.map((row, rowIndex) => <View key={rowIndex} wrap={false} style={styles.row}>{columns.map((column) => {
      const emphasis = column.emphasized?.(row);
      return <View key={column.label} style={[styles.td, { width: column.width }]}><VectorText width={column.width - 1} height={22} wrap={column.align === "left"} bold={emphasis === "strong"} align={column.align ?? "right"} color={emphasis === "zero" ? COLORS.zero : COLORS.ink}>{column.value(row)}</VectorText></View>;
    })}</View>) : <View style={styles.row}><View style={[styles.td, { width: columns.reduce((sum, c) => sum + c.width, 0) }]}><VectorText width={columns.reduce((sum, c) => sum + c.width, 0)} align="left">対象データがありません</VectorText></View></View>}
  </View>;
}

function SimpleTable({ headers, rows, widths }: { headers: string[]; rows: string[][]; widths: number[] }) {
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);
  return <View style={[styles.table, { width: tableWidth }]}><View fixed style={styles.row}>{headers.map((h, i) => <View key={h} style={[styles.th, { width: widths[i] }]}><VectorText width={widths[i] - 1} height={22} bold align="center" color="#FFFFFF">{h}</VectorText></View>)}</View>{rows.map((row, i) => <View key={i} wrap={false} style={styles.row}>{row.map((cell, j) => <View key={j} style={[styles.td, { width: widths[j] }]}><VectorParagraph width={widths[j] - 1}>{cell}</VectorParagraph></View>)}</View>)}</View>;
}

function SectionTitle({ children }: { children: string }) { return <><VectorText width={400} height={24} fontSize={15} bold align="left" color={COLORS.navy}>{children}</VectorText><View style={styles.accent} /></>; }
function DefinitionTitle({ children }: { children: string }) { return <VectorText width={650} height={20} fontSize={11} bold align="left" color={COLORS.navy}>{children}</VectorText>; }
function ContinuationLabel({ label, marker }: { label: string; marker: string }) {
  return <>
    <View fixed style={styles.continuationLabel}><VectorText width={735} height={16} fontSize={9} bold align="left" color={COLORS.navy}>{`${label}（続き）`}</VectorText></View>
    <View fixed style={styles.continuationCover} render={({ subPageNumber }) => subPageNumber === 1 ? <View style={styles.continuationCoverFill}/> : null}/>
    <Text fixed style={styles.hiddenMarker} render={({ subPageNumber }) => subPageNumber > 1 ? `CONTINUATION_${marker}` : ""}/>
  </>;
}
export function CallMetricsPdfDocument({ data, definitionRows = DEFINITIONS }: { data: CallMetricsResponse; definitionRows?: string[][] }): React.ReactElement<DocumentProps> {
  return <Document title="テレマ コール集計ポータル" author="Garden">
    <Page size="A3" orientation="portrait" wrap style={styles.page}><Chrome data={data}/><ContinuationLabel label="従業員ごと" marker="EMPLOYEE"/><Text style={styles.hiddenMarker}>SECTION_EMPLOYEE</Text><SectionTitle>従業員ごと</SectionTitle><DataTable columns={employeeColumns} rows={data.employeeMetrics}/></Page>
    <Page size="A3" orientation="portrait" wrap style={styles.page}><Chrome data={data}/><ContinuationLabel label="リストごと" marker="LIST"/><Text style={styles.hiddenMarker}>SECTION_LIST</Text><SectionTitle>リストごと</SectionTitle><DataTable columns={listColumns} rows={data.metrics}/></Page>
    <Page size="A3" orientation="portrait" wrap style={styles.page}><Chrome data={data}/><ContinuationLabel label="定義方法" marker="DEFINITION"/><Text style={styles.hiddenMarker}>SECTION_DEFINITION</Text><SectionTitle>定義方法</SectionTitle>
      <View style={styles.definitionBlock}><DefinitionTitle>集計の定義</DefinitionTitle><SimpleTable headers={["指標", "定義"]} rows={definitionRows} widths={[155, 580]}/></View>
      <View style={styles.definitionBlock}><DefinitionTitle>休憩時間割</DefinitionTitle><SimpleTable headers={["回", "開始", "終了", "長さ"]} rows={BREAKS} widths={[100, 170, 170, 170]}/><VectorParagraph width={735}>※ 休憩の時間帯が変わったときは、この表と稼働時間の計算式を変更する必要のため、管理者へ問合せてください。</VectorParagraph></View>
      <View style={styles.definitionBlock}><DefinitionTitle>コール履歴のフラグ名 → ポータル表示名</DefinitionTitle><SimpleTable headers={["コール履歴", "ポータル表示"]} rows={[["獲得", "受注数"], ["前確OK", "前確OK数"], ["トス", "トス数"]]} widths={[240, 370]}/></View>
      <View style={styles.definitionBlock}><DefinitionTitle>結果フラグの扱い（分類ルール）</DefinitionTitle><SimpleTable headers={["結果フラグ", "扱い"]} rows={FLAG_RULES} widths={[240, 370]}/></View>
    </Page>
  </Document>;
}

export function callMetricsPdfFilename(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `テレマコール集計ポータル_${get("year")}${get("month")}${get("day")}_${get("hour")}00.pdf`;
}

export async function renderCallMetricsPdf(data: CallMetricsResponse, options: { definitionRows?: string[][] } = {}) {
  return renderToBuffer(<CallMetricsPdfDocument data={data} definitionRows={options.definitionRows}/>);
}
