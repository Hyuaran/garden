import type { ReactNode } from "react";

export type HeaderProps = {
  appName: string;
  brandColor?: string;
  userName?: string;
  userRole?: string;
  rightActions?: ReactNode;
};

export function Header({ appName, brandColor = "#3B9B5C", userName, userRole, rightActions }: HeaderProps) {
  return (
    <header
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        background: "linear-gradient(90deg, #87CEEB, #E0F6FF)",
        borderBottom: `4px solid ${brandColor}`,
        gap: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 18 }}>{appName}</div>
      <div style={{ flex: 1 }} />
      {rightActions}
      {userName && (
        <div style={{ fontSize: 14 }}>
          {userName}
          {userRole && <span style={{ marginLeft: 8, opacity: 0.7 }}>({userRole})</span>}
        </div>
      )}
    </header>
  );
}
