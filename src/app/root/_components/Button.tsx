"use client";

import { ButtonHTMLAttributes } from "react";
import { colors } from "../_constants/colors";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export function Button({ variant = "primary", style, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const variants: Record<Variant, React.CSSProperties> = {
    primary:   { background: colors.primary,     color: colors.textOnDark, border: `1px solid ${colors.primary}` },
    secondary: { background: colors.bgPanel,     color: colors.text,        border: `1px solid ${colors.borderStrong}` },
    danger:    { background: colors.danger,      color: colors.textOnDark,  border: `1px solid ${colors.danger}` },
    ghost:     { background: "transparent",      color: colors.text,        border: `1px solid transparent` },
  };

  return (
    <button
      {...rest}
      style={{
        ...variants[variant],
        padding: "6px 14px",
        borderRadius: 6,
        cursor: rest.disabled ? "not-allowed" : "pointer",
        fontSize: 13,
        fontWeight: 500,
        opacity: rest.disabled ? 0.5 : 1,
        transition: "opacity 0.15s",
        ...style,
      }}
    />
  );
}
