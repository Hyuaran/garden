import type { CSSProperties } from "react";

export const budMobile = {
  colors: {
    page: "var(--m-bg)",
    paper: "var(--m-card)",
    surface: "var(--m-card)",
    gold: "var(--m-accent)",
    goldStrong: "var(--m-button)",
    text: "var(--m-ink)",
    sub: "var(--m-sub)",
    muted: "var(--m-sub)",
    border: "var(--m-line)",
    borderStrong: "var(--m-line)",
    green: "var(--m-accent)",
    red: "var(--m-red)",
  },
  font: {
    serif: "var(--m-font)",
    number: "var(--m-font)",
  },
} as const;

export const budPage: CSSProperties = {
  minHeight: "100dvh",
  maxWidth: 560,
  margin: "0 auto",
  padding: "20px 16px 18px",
  background: "var(--m-bg)",
  color: budMobile.colors.text,
  fontFamily: budMobile.font.serif,
};

export const budHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 18,
};

export const budBackLink: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: budMobile.colors.gold,
  background: "var(--m-card)",
  border: `1px solid ${budMobile.colors.border}`,
  boxShadow: "0 2px 8px rgba(61,53,40,0.05)",
  fontSize: 20,
  flexShrink: 0,
};

export const budTitle: CSSProperties = {
  margin: 0,
  color: budMobile.colors.text,
  fontFamily: budMobile.font.serif,
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: "0.04em",
  lineHeight: 1.25,
};

export const budLead: CSSProperties = {
  margin: "4px 0 0",
  color: budMobile.colors.sub,
  fontSize: 12,
  lineHeight: 1.6,
};

export const budCard: CSSProperties = {
  background: "var(--m-card)",
  border: `1px solid ${budMobile.colors.border}`,
  borderRadius: 22,
  boxShadow: "0 6px 18px rgba(61,53,40,0.07)",
};

export const budNotice: CSSProperties = {
  ...budCard,
  padding: 22,
  textAlign: "center",
  color: budMobile.colors.sub,
  fontSize: 13,
  lineHeight: 1.8,
};

export const budPrimaryButton: CSSProperties = {
  border: "none",
  borderRadius: 999,
  padding: "11px 16px",
  background: budMobile.colors.goldStrong,
  color: "#fff",
  fontFamily: budMobile.font.serif,
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: "0.04em",
  boxShadow: "0 4px 12px var(--m-tint)",
};

export const budSecondaryButton: CSSProperties = {
  border: `1px solid ${budMobile.colors.borderStrong}`,
  borderRadius: 999,
  padding: "10px 14px",
  background: "var(--m-card)",
  color: budMobile.colors.gold,
  fontFamily: budMobile.font.serif,
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: "0.04em",
};

export const budSectionTitle: CSSProperties = {
  margin: "0 0 10px",
  color: budMobile.colors.gold,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "0.06em",
  paddingBottom: 8,
  borderBottom: "1px dashed var(--m-tint)",
};
