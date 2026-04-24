"use client";

import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { colors } from "../_constants/colors";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: colors.textMuted,
  marginBottom: 4,
};

const baseInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 14,
  borderRadius: 4,
  background: colors.bgPanel,
  color: colors.text,
  outline: "none",
  boxSizing: "border-box",
};

const errorTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: colors.danger,
  marginTop: 4,
  lineHeight: 1.4,
};

function inputStyle(error: boolean): React.CSSProperties {
  return {
    ...baseInputStyle,
    border: `1px solid ${error ? colors.danger : colors.border}`,
    background: error ? colors.dangerBg : colors.bgPanel,
  };
}

type CommonExtra = { label: string; required?: boolean; error?: string };

export function TextField({ label, required, error, ...rest }: CommonExtra & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={labelStyle}>{label}{required && <span style={{ color: colors.danger, marginLeft: 4 }}>*</span>}</span>
      <input {...rest} style={inputStyle(!!error)} aria-invalid={!!error || undefined} />
      {error && <div style={errorTextStyle}>{error}</div>}
    </label>
  );
}

export function SelectField({ label, required, error, children, ...rest }: CommonExtra & { children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={labelStyle}>{label}{required && <span style={{ color: colors.danger, marginLeft: 4 }}>*</span>}</span>
      <select {...rest} style={inputStyle(!!error)} aria-invalid={!!error || undefined}>{children}</select>
      {error && <div style={errorTextStyle}>{error}</div>}
    </label>
  );
}

export function TextareaField({ label, required, error, ...rest }: CommonExtra & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={labelStyle}>{label}{required && <span style={{ color: colors.danger, marginLeft: 4 }}>*</span>}</span>
      <textarea {...rest} style={{ ...inputStyle(!!error), minHeight: 60, resize: "vertical" }} aria-invalid={!!error || undefined} />
      {error && <div style={errorTextStyle}>{error}</div>}
    </label>
  );
}

export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "0 16px" }}>
      {children}
    </div>
  );
}
