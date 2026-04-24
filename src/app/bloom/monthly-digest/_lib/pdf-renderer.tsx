/**
 * 月次ダイジェスト PDF レンダラー (@react-pdf/renderer v4)
 *
 * T6 の DigestPageFrame / 各 kind コンポーネントと対応する PDF 版。
 * HTML/CSS と異なり @react-pdf は限定 CSS（flexbox のみ、grid 非対応）。
 *
 * 日本語フォント:
 *   - public/fonts/NotoSansJP-Regular.ttf
 *   - public/fonts/NotoSansJP-Bold.ttf
 *   ※ ファイル未配置のときは Font.register を skip し、
 *     システムフォントで PDF を生成する（日本語が □ になるため本番前に要配置）
 *
 * 依存: @react-pdf/renderer ^4
 */

import path from "node:path";
import { existsSync } from "node:fs";

import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";

import type {
  DigestPage,
  DigestPageKind,
  MonthlyDigest,
} from "../../_types/monthly-digest";

// ---- フォント登録（起動時 1 回）-----------------------------------------

const FONT_FAMILY = "NotoSansJP";
let fontsRegistered = false;
let fontsAvailable = false;

function registerFontsOnce(): boolean {
  if (fontsRegistered) return fontsAvailable;
  fontsRegistered = true;

  const fontDir = path.join(process.cwd(), "public", "fonts");
  const regular = path.join(fontDir, "NotoSansJP-Regular.ttf");
  const bold = path.join(fontDir, "NotoSansJP-Bold.ttf");

  if (!existsSync(regular) || !existsSync(bold)) {
    console.warn(
      "[bloom/pdf] NotoSansJP fonts not found in public/fonts/. " +
        "Japanese characters may render as □. " +
        "Place NotoSansJP-Regular.ttf and NotoSansJP-Bold.ttf to fix.",
    );
    return false;
  }

  try {
    Font.register({
      family: FONT_FAMILY,
      fonts: [
        { src: regular, fontWeight: "normal" },
        { src: bold, fontWeight: "bold" },
      ],
    });
    fontsAvailable = true;
    return true;
  } catch (err) {
    console.error("[bloom/pdf] Font.register failed:", err);
    return false;
  }
}

// ---- スタイル -----------------------------------------------------------

const COLORS = {
  text: "#1b4332",
  sub: "#40916c",
  muted: "#6b8e75",
  accent: "#40916c",
  line: "#95d5b2",
  bg: "#ffffff",
  pageBg: "#f1f8f4",
} as const;

const KIND_ICON_LABEL: Record<DigestPageKind, { icon: string; label: string }> = {
  cover: { icon: "🌸", label: "表紙" },
  achievements: { icon: "🏆", label: "主要達成" },
  progress_graph: { icon: "📊", label: "進捗グラフ" },
  next_month_goals: { icon: "🎯", label: "来月の目標" },
  work_summary: { icon: "🧮", label: "稼働サマリ" },
  custom: { icon: "📄", label: "カスタム" },
};

function buildStyles(useJpFont: boolean) {
  const baseFontFamily = useJpFont ? FONT_FAMILY : "Helvetica";
  return StyleSheet.create({
    page: {
      paddingTop: 48,
      paddingBottom: 48,
      paddingHorizontal: 56,
      fontFamily: baseFontFamily,
      fontSize: 12,
      color: COLORS.text,
      backgroundColor: COLORS.bg,
    },
    pageCover: {
      paddingTop: 120,
      paddingBottom: 48,
      paddingHorizontal: 56,
      fontFamily: baseFontFamily,
      color: COLORS.text,
      backgroundColor: COLORS.pageBg,
    },
    headerBar: {
      height: 4,
      backgroundColor: COLORS.accent,
      marginBottom: 20,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
    },
    icon: {
      fontSize: 26,
      marginRight: 10,
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: COLORS.text,
    },
    kindLabel: {
      fontSize: 10,
      color: COLORS.muted,
      marginBottom: 6,
    },
    coverTitle: {
      fontSize: 32,
      fontWeight: "bold",
      color: COLORS.text,
      marginBottom: 12,
      textAlign: "center",
    },
    coverSub: {
      fontSize: 14,
      color: COLORS.sub,
      textAlign: "center",
      marginBottom: 40,
    },
    coverBody: {
      fontSize: 13,
      color: COLORS.text,
      lineHeight: 1.7,
      marginTop: 20,
    },
    body: {
      fontSize: 12,
      lineHeight: 1.7,
      color: COLORS.text,
    },
    imageBox: {
      marginTop: 18,
      borderRadius: 6,
      overflow: "hidden",
      border: `1pt solid ${COLORS.line}`,
    },
    image: {
      width: "100%",
      objectFit: "contain",
    },
    placeholder: {
      marginTop: 18,
      padding: 16,
      backgroundColor: COLORS.pageBg,
      borderRadius: 6,
      fontSize: 11,
      color: COLORS.muted,
      textAlign: "center",
    },
    footer: {
      position: "absolute",
      bottom: 24,
      left: 56,
      right: 56,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 9,
      color: COLORS.muted,
    },
  });
}

// ---- サブコンポーネント -------------------------------------------------

function PageCover({
  digest,
  styles,
}: {
  digest: MonthlyDigest;
  styles: ReturnType<typeof buildStyles>;
}) {
  const monthKey = digest.digest_month.slice(0, 7);
  return (
    <Page size="A4" style={styles.pageCover}>
      <View style={styles.headerBar} />
      <Text style={styles.coverTitle}>{digest.title}</Text>
      <Text style={styles.coverSub}>{monthKey}</Text>
      {digest.summary ? (
        <Text style={styles.coverBody}>{digest.summary}</Text>
      ) : null}
    </Page>
  );
}

function BodyPage({
  page,
  pageIndex,
  totalPages,
  styles,
}: {
  page: DigestPage;
  pageIndex: number;
  totalPages: number;
  styles: ReturnType<typeof buildStyles>;
}) {
  const meta = KIND_ICON_LABEL[page.kind] ?? KIND_ICON_LABEL.custom;
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.headerBar} />
      <Text style={styles.kindLabel}>{meta.label}</Text>
      <View style={styles.titleRow}>
        <Text style={styles.icon}>{meta.icon}</Text>
        <Text style={styles.title}>{page.title}</Text>
      </View>

      <Text style={styles.body}>{page.body || "（本文未記入）"}</Text>

      {page.image_url ? (
        <View style={styles.imageBox}>
          <Image src={page.image_url} style={styles.image} />
        </View>
      ) : page.kind === "progress_graph" ? (
        <View style={styles.placeholder}>
          <Text>グラフ画像未登録</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text>Garden Bloom — 月次ダイジェスト</Text>
        <Text>
          {pageIndex + 1} / {totalPages}
        </Text>
      </View>
    </Page>
  );
}

// ---- エントリ -----------------------------------------------------------

export function DigestDocument({
  digest,
}: {
  digest: MonthlyDigest;
}): React.ReactElement<DocumentProps> {
  const useJpFont = registerFontsOnce();
  const styles = buildStyles(useJpFont);

  const bodyPages = digest.pages.filter((p) => p.kind !== "cover");
  const coverFromPages = digest.pages.find((p) => p.kind === "cover");

  const totalBody = bodyPages.length;

  return (
    <Document title={digest.title} author="Garden Bloom">
      <PageCover
        digest={{
          ...digest,
          summary: digest.summary ?? coverFromPages?.body ?? null,
        }}
        styles={styles}
      />
      {bodyPages.map((page, i) => (
        <BodyPage
          key={i}
          page={page}
          pageIndex={i}
          totalPages={totalBody}
          styles={styles}
        />
      ))}
    </Document>
  );
}

export function digestFilename(monthKey: string): string {
  return `bloom-monthly-digest-${monthKey}.pdf`;
}
