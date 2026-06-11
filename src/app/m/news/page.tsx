"use client";

export default function MobileNewsPage() {
  return (
    <main style={page}>
      <header style={head}>
        <h1 style={title}>お知らせ</h1>
        <p style={lead}>Gardenからの通知をここにまとめます。</p>
      </header>
      <div style={notice}>お知らせはまだありません。</div>
    </main>
  );
}

const page: React.CSSProperties = { minHeight: "100dvh", background: "#f7f4ec", padding: "20px 16px 18px", maxWidth: 560, margin: "0 auto" };
const head: React.CSSProperties = { marginBottom: 18 };
const title: React.CSSProperties = { margin: 0, color: "#3d3528", fontSize: 24 };
const lead: React.CSSProperties = { margin: "6px 0 0", color: "#7b745f", fontSize: 12 };
const notice: React.CSSProperties = { background: "#fffdf6", border: "1px solid #e2ddcf", borderRadius: 14, padding: 28, textAlign: "center", color: "#6d6356", fontSize: 13 };
