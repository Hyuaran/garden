import path from "node:path";
import { Document, G, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { openSync } from "fontkit";
import type { CallMetricsResponse, EmployeeCallMetricRow, CallMetricRow } from "./call-metrics";
import { formatCallsPerWorkHour, formatWorkTime } from "./call-metrics";
import { LP_FUNNEL_DEFINITIONS, LP_FUNNEL_LEAD_NOTE, lpFunnelCalcNotes, lpFunnelHeaders, lpFunnelTableA, lpFunnelTableB } from "./lp-funnel-view";

const COLORS = { bg: "#F4F5F7", card: "#FFFFFF", line: "#E3EAF3", navy: "#10233F", teal: "#0EA5A0", ink: "#17212E", sub: "#5A6B80", zero: "#98A4B3", red: "#E5484D" } as const;
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
  // テレマの列と WEBインバウンド（LP系）の列の境（無効｜LP応答）に太い区切り線（東海林さん 2026-10-15）
  groupStart: { borderLeftWidth: 2, borderLeftColor: COLORS.teal },
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

type Column<T> = { label: string; width: number; value: (row: T) => string; align?: "left" | "center"; emphasized?: (row: T) => "zero" | "strong" | null; groupStart?: boolean };
type ColumnGroup = { label: string; span: number };
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const maybeNumber = (value: number | null | undefined) => value == null ? "-" : value.toLocaleString("ja-JP");
const maybeTime = (value: number | null | undefined) => value == null ? "-" : formatWorkTime(value);
export const callMetricCountTone = (value: number) => value === 0 ? "zero" as const : "strong" as const;
// 「（内線未登録）n席」の行は FileMaker 由来の列（稼働時間〜無効）を「-」にする（§5.5.2）
const isUnregisteredRow = (r: EmployeeCallMetricRow) => r.employeeName.startsWith("（内線未登録）");
const fm = (r: EmployeeCallMetricRow, value: string) => isUnregisteredRow(r) ? "-" : value;
const fmTone = (r: EmployeeCallMetricRow, value: number) => isUnregisteredRow(r) ? null : callMetricCountTone(value);
const employeeColumnGroups: ColumnGroup[] = [{ label: "テレマ", span: 15 }, { label: "WEBインバウンド（LP系）", span: 4 }];

const employeeColumns: Column<EmployeeCallMetricRow>[] = [
  { label: "社員名", width: 92, value: (r) => r.employeeName, align: "left" },
  { label: "稼働時間", width: 58, value: (r) => fm(r, formatWorkTime(r.workSeconds)) },
  { label: "通話時間", width: 58, value: (r) => maybeTime(r.talkSecondsOther) },
  { label: "コール数", width: 43, value: (r) => fm(r, r.callCount.toLocaleString("ja-JP")) },
  { label: "コール数/h", width: 46, value: (r) => fm(r, formatCallsPerWorkHour(r.callCount, r.workSeconds)) },
  { label: "有効数", width: 39, value: (r) => fm(r, r.effectiveCount.toLocaleString("ja-JP")) },
  { label: "有効率", width: 42, value: (r) => fm(r, pct(r.effectiveRate)) },
  { label: "トス数", width: 37, value: (r) => fm(r, String(r.tossCount)), emphasized: (r) => fmTone(r, r.tossCount) },
  { label: "トス率", width: 41, value: (r) => fm(r, pct(r.callCount ? r.tossCount / r.callCount : 0)) },
  { label: "受注数", width: 39, value: (r) => fm(r, String(r.acquiredCount)), emphasized: (r) => fmTone(r, r.acquiredCount) },
  { label: "前確OK数", width: 46, value: (r) => fm(r, String(r.orderCount)), emphasized: (r) => fmTone(r, r.orderCount) },
  { label: "見込", width: 34, value: (r) => fm(r, String(r.prospectCount)) },
  { label: "担不", width: 34, value: (r) => fm(r, String(r.absentCount)) },
  { label: "留守", width: 34, value: (r) => fm(r, String(r.awayCount)) },
  { label: "無効", width: 34, value: (r) => fm(r, String(r.invalidCount)) },
  { label: "LP応答", width: 44, value: (r) => maybeNumber(r.lpAnswered), groupStart: true },
  { label: "LP発信", width: 44, value: (r) => maybeNumber(r.lpOutbound) },
  { label: "LP通話時間", width: 58, value: (r) => maybeTime(r.lpTalkSeconds) },
  { label: "LP申込み", width: 44, value: (r) => maybeNumber(r.lpApplications) },
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
  ["受注率", "受注数 ÷ 有効数（2026-10-09 から。以前は総コール数で割っていました）"], ["前確OK率", "前確OK数 ÷ 受注数。受注が 0 件の日は 0％（2026-10-09 から。以前は総コール数で割っていました）"],
  ["稼働時間", "その日の最初のコールから最後のコールまでの時間から、休憩時間（下表）を引いた実働時間です。その休憩の時間帯をまたいで働いていた場合に、その休憩の長さをまるごと引きます（休憩中に架電していても、別の時間に同じ長さの休憩を取っているため引きます）。休憩の途中から働き始めた日・途中で終えた日は、その休憩は引きません。"],
  ["コール数/h", "コール数 ÷ 稼働時間（時間）。1時間あたり何件かけたかです。"], ["見込", "結果フラグが「見込」のコール"],
  ["担不", "結果フラグが「担不」（担当者不在）のコール"], ["留守", "結果フラグが「留守」のコール"], ["無効", "結果フラグが「無効」のコール"],
  ["リスト絞り込み時の稼働時間", "リストで絞り込んだ場合、稼働時間はそのリストを架電していた時間の幅になります。"],
  ["Excel集計表との差", "※ 従来のExcel集計表は休憩を引いていないため、こちらの方が短く出ます。"],
  ["リスト数・回転数・リスト受注率", "リストデータ取込後に対応"],
  ["通話時間と WEBインバウンド（LP系）", "INNOVERA の通話秒数、LP 系回線の応答・発信・通話時間、kintone の申込み件数を表示します。取得できない値は「-」です。"],
];

// ヘッダ帯の「INNOVERA 最終取込 HH:MM」（JST）。20 分以上前なら赤字で「INNOVERA 取込停止中（最終 HH:MM）」（§7.2）
function formatShortJstTime(value: string | null | undefined) {
  if (!value) return "データなし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "データなし";
  const parts = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")}`;
}
export function innoveraHeaderText(data: CallMetricsResponse) {
  if (!data.innovera) return null;
  const time = formatShortJstTime(data.innovera.lastSyncAt);
  return data.innovera.stopped ? { text: `INNOVERA 取込停止中（最終 ${time}）`, stopped: true } : { text: `INNOVERA 最終取込 ${time}`, stopped: false };
}

function Chrome({ data }: { data: CallMetricsResponse }) {
  const period = `対象期間 ${data.from}〜${data.to}`;
  const innovera = innoveraHeaderText(data);
  const header = <>
    <VectorText width={350} height={18} fontSize={11} bold align="left" color={COLORS.navy}>テレマ コール集計ポータル</VectorText>
    <View style={{ flexDirection: "row", height: 18 }}>
      <VectorText width={250} height={18} fontSize={8} align="right" color={COLORS.sub}>{period}</VectorText>
      {innovera ? <VectorText width={220} height={18} fontSize={8} align="right" bold={innovera.stopped} color={innovera.stopped ? COLORS.red : COLORS.sub}>{innovera.text}</VectorText> : null}
    </View>
  </>;
  return <><View style={styles.header}>{header}</View><View fixed style={styles.header}>{header}</View><Text fixed style={styles.hiddenMarker}>{`PDF_HEADER ${data.from} ${data.to}`}</Text><Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></>;
}

function DataTable<T>({ columns, rows, groups }: { columns: Column<T>[]; rows: T[]; groups?: ColumnGroup[] }) {
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  // 見出し 2 段の上段（例：テレマ｜WEBインバウンド（LP系））。各グループの幅＝含む列の幅の合計
  const groupCells = groups?.map((group, index) => {
    const start = groups.slice(0, index).reduce((sum, g) => sum + g.span, 0);
    const width = columns.slice(start, start + group.span).reduce((sum, column) => sum + column.width, 0);
    return { ...group, width, groupStart: index > 0 };
  });
  const cellStyle = (base: typeof styles.th | typeof styles.td, column: { width: number; groupStart?: boolean }) => column.groupStart ? [base, styles.groupStart, { width: column.width }] : [base, { width: column.width }];
  return <View style={[styles.table, { width: tableWidth }]}>
    {groupCells ? <View fixed style={styles.row}>{groupCells.map((group) => <View key={group.label} style={cellStyle(styles.th, group)}><VectorText width={group.width - 1} height={22} bold align="center" color="#FFFFFF">{group.label}</VectorText></View>)}</View> : null}
    <View fixed style={styles.row}>{columns.map((column) => <View key={column.label} style={cellStyle(styles.th, column)}><VectorText width={column.width - 1} height={22} bold align="center" color="#FFFFFF">{column.label}</VectorText></View>)}</View>
    {rows.length ? rows.map((row, rowIndex) => <View key={rowIndex} wrap={false} style={styles.row}>{columns.map((column) => {
      const emphasis = column.emphasized?.(row);
      return <View key={column.label} style={cellStyle(styles.td, column)}><VectorText width={column.width - 1} height={22} wrap={column.align === "left"} bold={emphasis === "strong"} align={column.align ?? "right"} color={emphasis === "zero" ? COLORS.zero : COLORS.ink}>{column.value(row)}</VectorText></View>;
    })}</View>) : <View style={styles.row}><View style={[styles.td, { width: columns.reduce((sum, c) => sum + c.width, 0) }]}><VectorText width={columns.reduce((sum, c) => sum + c.width, 0)} align="left">対象データがありません</VectorText></View></View>}
  </View>;
}

// 申込みの列は「5（うち担当者未設定 1）」が 1 行に入る幅（東海林さん 2026-10-15）
const lpSubtotalWidths = [220, 60, 60, 60, 60, 60, 80, 80, 200];
function LpSubtotalTable({ data }: { data: CallMetricsResponse }) {
  const rows = [...(data.lp?.businesses ?? []), ...(data.lp?.totals ? [data.lp.totals] : [])].map((row) => [
    row.bizName,
    maybeNumber(row.inbound),
    maybeNumber(row.answered),
    maybeNumber(row.missed),
    maybeNumber(row.voicemail),
    maybeNumber(row.outbound),
    maybeNumber(row.outboundAnswered),
    maybeTime(row.talkSeconds),
    row.unassignedApplications ? `${maybeNumber(row.applications)}（うち担当者未設定 ${row.unassignedApplications}）` : maybeNumber(row.applications),
  ]);
  return <SimpleTable headers={["事業名", "着信", "応答", "不在", "留守電", "発信", "発信の応答", "通話時間", "申込み"]} rows={rows} widths={lpSubtotalWidths}/>;
}

// 第 2 部「WEBインバウンド（事業ごと）」＝表A「対応」と表B「結果」（§5.6.5）。列幅 pt＝指標名 220／事業ごと 110／合計 110
function LpFunnelPart({ data }: { data: CallMetricsResponse }) {
  const funnel = data.lpFunnel;
  if (!funnel) return <VectorParagraph width={870}>WEBインバウンドの対応と結果を取得できませんでした。</VectorParagraph>;
  const headers = lpFunnelHeaders(funnel);
  const widths = [220, ...headers.slice(1).map(() => 110)];
  const toRows = (rows: ReturnType<typeof lpFunnelTableA>) => rows.map((row) => [`${"　".repeat(row.indent ?? 0)}${row.label}`, ...row.values]);
  const notes = lpFunnelCalcNotes(funnel);
  const noRecordTotal = funnel.businesses.reduce((sum, biz) => sum + (biz.noRecord ?? 0), 0);
  return <>
    <View style={styles.definitionBlock}><DefinitionTitle>表A　対応</DefinitionTitle><SimpleTable headers={headers} rows={toRows(lpFunnelTableA(funnel))} widths={widths}/></View>
    <View style={styles.definitionBlock}><DefinitionTitle>表B　結果</DefinitionTitle><SimpleTable headers={headers} rows={toRows(lpFunnelTableB(funnel))} widths={widths}/></View>
    <VectorParagraph width={870}>{`${LP_FUNNEL_LEAD_NOTE}${noRecordTotal ? ` 記録なし ${noRecordTotal} 件の番号はポータルの「WEBインバウンド」タブで確かめてください。` : ""}`}</VectorParagraph>
    {notes.map((note) => <VectorParagraph key={note} width={870}>{note}</VectorParagraph>)}
  </>;
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
    <Page size="A3" orientation="landscape" wrap style={styles.page}><Chrome data={data}/><ContinuationLabel label="従業員ごと" marker="EMPLOYEE"/><Text style={styles.hiddenMarker}>SECTION_EMPLOYEE</Text><SectionTitle>従業員ごと</SectionTitle><DataTable columns={employeeColumns} rows={data.employeeMetrics} groups={employeeColumnGroups}/><View style={styles.definitionBlock}><DefinitionTitle>事業別の小計</DefinitionTitle><LpSubtotalTable data={data}/>{data.lp?.unregisteredExtensionSummary ? <VectorParagraph width={870}>{data.lp.unregisteredExtensionSummary}</VectorParagraph> : null}</View></Page>
    <Page size="A3" orientation="landscape" wrap style={styles.page}><Chrome data={data}/><Text style={styles.hiddenMarker}>SECTION_WEB_INBOUND</Text><SectionTitle>WEBインバウンド（事業ごと）</SectionTitle><LpFunnelPart data={data}/></Page>
    <Page size="A3" orientation="landscape" wrap style={styles.page}><Chrome data={data}/><ContinuationLabel label="リストごと" marker="LIST"/><Text style={styles.hiddenMarker}>SECTION_LIST</Text><SectionTitle>リストごと</SectionTitle><DataTable columns={listColumns} rows={data.metrics}/></Page>
    <Page size="A3" orientation="landscape" wrap style={styles.page}><Chrome data={data}/><ContinuationLabel label="定義方法" marker="DEFINITION"/><Text style={styles.hiddenMarker}>SECTION_DEFINITION</Text><SectionTitle>定義方法</SectionTitle>
      <View style={styles.definitionBlock}><DefinitionTitle>集計の定義</DefinitionTitle><SimpleTable headers={["指標", "定義"]} rows={definitionRows} widths={[155, 580]}/></View>
      <View style={styles.definitionBlock}><DefinitionTitle>休憩時間割</DefinitionTitle><SimpleTable headers={["回", "開始", "終了", "長さ"]} rows={BREAKS} widths={[100, 170, 170, 170]}/><VectorParagraph width={735}>※ 休憩の時間帯が変わったときは、この表と稼働時間の計算式を変更する必要のため、管理者へ問合せてください。</VectorParagraph></View>
      <View style={styles.definitionBlock}><DefinitionTitle>コール履歴のフラグ名 → ポータル表示名</DefinitionTitle><SimpleTable headers={["コール履歴", "ポータル表示"]} rows={[["獲得", "受注数"], ["前確OK", "前確OK数"], ["トス", "トス数"]]} widths={[240, 370]}/></View>
      <View style={styles.definitionBlock}><DefinitionTitle>結果フラグの扱い（分類ルール）</DefinitionTitle><SimpleTable headers={["結果フラグ", "扱い"]} rows={FLAG_RULES} widths={[240, 370]}/></View>
      <View style={styles.definitionBlock}><DefinitionTitle>WEBインバウンドの対応と結果</DefinitionTitle><SimpleTable headers={["項目", "定義"]} rows={LP_FUNNEL_DEFINITIONS} widths={[200, 680]}/></View>
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
