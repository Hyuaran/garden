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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 14,
  border: `1px solid ${colors.border}`,
  borderRadius: 4,
  background: colors.bgPanel,
  color: colors.text,
  outline: "none",
  boxSizing: "border-box",
};

export function TextField({ label, required, ...rest }: { label: string; required?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={labelStyle}>{label}{required && <span style={{ color: colors.danger, marginLeft: 4 }}>*</span>}</span>
      <input {...rest} style={inputStyle} />
    </label>
  );
}

export function SelectField({ label, required, children, ...rest }: { label: string; required?: boolean; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={labelStyle}>{label}{required && <span style={{ color: colors.danger, marginLeft: 4 }}>*</span>}</span>
      <select {...rest} style={inputStyle}>{children}</select>
    </label>
  );
}

export function TextareaField({ label, required, ...rest }: { label: string; required?: boolean } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={labelStyle}>{label}{required && <span style={{ color: colors.danger, marginLeft: 4 }}>*</span>}</span>
      <textarea {...rest} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />
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
